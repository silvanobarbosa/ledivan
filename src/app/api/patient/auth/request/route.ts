import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

  // Anti-spam: máx 3 códigos por telefone a cada 10min. Silencioso (anti-enumeração): responde ok sem enviar.
  if (!(await rateLimit(`patient-request:${key}`, "patient-request", 3, 600))) {
    return NextResponse.json({ ok: true });
  }

  const pats = await db.select({ id: patients.id, userId: patients.userId, phone: patients.phone }).from(patients);
  const patient = pats.find((p) => last11(p.phone) === key);

  if (patient?.phone) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.delete(patientAuthCode).where(eq(patientAuthCode.patientId, patient.id)).catch(() => {});
    await db.insert(patientAuthCode).values({ patientId: patient.id, code, expiresAt: new Date(Date.now() + 10 * 60_000) }).catch(() => {});
    await sendWhatsappFromUser(patient.userId, patient.phone, `Seu código de acesso ao app Ledivan: *${code}*\nVale por 10 minutos. Se não foi você, ignore.`).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
