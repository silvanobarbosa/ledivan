import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { patients, patientAuthCode } from "@/db/schema";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const last11 = (s?: string | null) => (s || "").replace(/\D/g, "").slice(-11);

// POST /api/patient/auth/request { phone } — envia um código de 6 dígitos pelo WhatsApp do terapeuta.
// Resposta SEMPRE genérica (anti-enumeração): não revela se o telefone existe.
export async function POST(req: Request) {
  let b: { phone?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const key = last11(b.phone);
  if (key.length < 10) return NextResponse.json({ ok: false, error: "Telefone inválido." }, { status: 400 });

  // Rate-limit por IP tambem: o limite por telefone é burlável variando o número — e cada
  // tentativa antes fazia um SCAN da tabela inteira de pacientes. Fail-closed.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (!(await rateLimit(ip, "patient-request-ip", 30, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: true });
  }
  // Anti-spam: máx 3 códigos por telefone a cada 10min. Silencioso (anti-enumeração): responde ok sem enviar.
  if (!(await rateLimit(`patient-request:${key}`, "patient-request", 3, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: true });
  }

  // Filtra no BANCO pelos últimos 11 dígitos (antes carregava TODA a tabela e filtrava em JS —
  // full scan + memória a cada request público). Ainda sem índice dedicado, mas não materializa
  // mais a base inteira na função.
  const rows = await db
    .select({ id: patients.id, userId: patients.userId, phone: patients.phone })
    .from(patients)
    .where(sql`right(regexp_replace(coalesce(${patients.phone}, ''), '[^0-9]', '', 'g'), 11) = ${key}`)
    .limit(1);
  const patient = rows[0];

  if (patient?.phone) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.delete(patientAuthCode).where(eq(patientAuthCode.patientId, patient.id)).catch(() => {});
    await db.insert(patientAuthCode).values({ patientId: patient.id, code, expiresAt: new Date(Date.now() + 10 * 60_000) }).catch(() => {});
    await sendWhatsappFromUser(patient.userId, patient.phone, `Seu código de acesso ao app Ledivan: *${code}*\nVale por 10 minutos. Se não foi você, ignore.`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
