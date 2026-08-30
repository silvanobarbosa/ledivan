import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { patients, patientAuthCode } from "@/db/schema";
import { signPatient } from "@/lib/patient-token";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const last11 = (s?: string | null) => (s || "").replace(/\D/g, "").slice(-11);

// POST /api/patient/auth/verify { phone, code } — valida o código e devolve o token bearer.
export async function POST(req: Request) {
  let b: { phone?: string; code?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const key = last11(b.phone);
  const code = (b.code || "").replace(/\D/g, "");
  if (key.length < 10 || code.length !== 6) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  // Anti-brute-force: máx 6 tentativas por telefone a cada 10min (código de 6 díg seria forçável senão).
  if (!(await rateLimit(`patient-verify:${key}`, "patient-verify", 6, 600))) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos e peça um novo código." }, { status: 429 });
  }

  const pats = await db.select({ id: patients.id, userId: patients.userId, name: patients.name, phone: patients.phone }).from(patients);
  const patient = pats.find((p) => last11(p.phone) === key);
  if (!patient) return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 401 });

  const [row] = await db.select().from(patientAuthCode)
    .where(eq(patientAuthCode.patientId, patient.id)).orderBy(desc(patientAuthCode.createdAt)).limit(1);
  if (!row || row.code !== code || new Date(row.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Código inválido ou expirado." }, { status: 401 });
  }
  await db.delete(patientAuthCode).where(eq(patientAuthCode.patientId, patient.id)).catch(() => {});

  const token = signPatient(patient.id, patient.userId);
  return NextResponse.json({ ok: true, token, patient: { name: patient.name } });
}
