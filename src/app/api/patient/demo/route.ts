import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { signPatient } from "@/lib/patient-token";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Login de DEMONSTRAÇÃO do paciente (Srta. Dionísia) — sem código por WhatsApp.
// Emite um bearer READ-ONLY (claim `demo`) para a paciente-modelo sob a conta do terapeuta
// demo. O proxy recusa qualquer escrita feita com esse token. Público, só leitura.
const THERAPIST_EMAIL = "socrates@ledivan.com.br";
const PATIENT_EMAIL = "dionisia@demo.ledivan.com.br";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (!(await rateLimit(ip, "patient-demo", 20, 3600, { failClosed: true }))) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const therapist = await db.query.users.findFirst({ where: eq(users.email, THERAPIST_EMAIL) });
  if (!therapist?.isDemo) return NextResponse.json({ error: "Demo indisponível." }, { status: 404 });

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.userId, therapist.id), eq(patients.email, PATIENT_EMAIL)),
  });
  if (!patient) return NextResponse.json({ error: "Demo indisponível." }, { status: 404 });

  // 7 dias, claim demo → read-only no proxy.
  const token = signPatient(patient.id, therapist.id, 7, { demo: true });
  return NextResponse.json({ token, patient: { name: patient.name } });
}
