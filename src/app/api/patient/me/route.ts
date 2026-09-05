import { NextResponse } from "next/server";
import { and, eq, gte, asc, desc, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { patients, users, therapySessions } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveAll, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/me — dados do paciente + terapeuta + próxima sessão. Bearer do paciente.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [patient] = await db.select({ name: patients.name, category: patients.category }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  const [therapist] = await db.select({ name: users.name }).from(users).where(eq(users.id, p.userId)).limit(1);
  const [next] = await db.select({ id: therapySessions.id, date: therapySessions.date, isOnline: therapySessions.isOnline })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, p.userId), eq(therapySessions.patientId, p.patientId), eq(therapySessions.status, "agendada"), gte(therapySessions.date, new Date())))
    .orderBy(asc(therapySessions.date)).limit(1);

  // Recursos ligados pra este paciente (o app usa pra saber o que mostrar).
  const prefs = await getPreferences(p.userId);
  const [pov] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  const features = resolveAll(prefs.features, parseOverrides(pov?.ov));

  // Cronômetro ativo — só se o recurso está ligado E o terapeuta escolheu mostrar.
  let activeTimer: { startedAt: string } | null = null;
  if (features.timer && !!prefs.timerShowToPatient) {
    const [t] = await db.select({ startedAt: therapySessions.timerStartedAt })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, p.userId), eq(therapySessions.patientId, p.patientId), isNotNull(therapySessions.timerStartedAt), isNull(therapySessions.timerEndedAt)))
      .orderBy(desc(therapySessions.timerStartedAt)).limit(1);
    if (t?.startedAt) activeTimer = { startedAt: (t.startedAt as Date).toISOString() };
  }

  return NextResponse.json({
    patient: { name: patient.name, category: patient.category ?? "adulto" },
    therapist: { name: therapist?.name ?? "Seu terapeuta" },
    nextSession: next ? { id: next.id, date: (next.date as Date).toISOString(), isOnline: next.isOnline } : null,
    activeTimer,
    features,
  });
}
