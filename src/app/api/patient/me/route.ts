import { NextResponse } from "next/server";
import { and, eq, gte, asc } from "drizzle-orm";
import { db } from "@/db";
import { patients, users, therapySessions } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/me — dados do paciente + terapeuta + próxima sessão. Bearer do paciente.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [patient] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  const [therapist] = await db.select({ name: users.name }).from(users).where(eq(users.id, p.userId)).limit(1);
  const [next] = await db.select({ id: therapySessions.id, date: therapySessions.date, isOnline: therapySessions.isOnline })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, p.userId), eq(therapySessions.patientId, p.patientId), eq(therapySessions.status, "agendada"), gte(therapySessions.date, new Date())))
    .orderBy(asc(therapySessions.date)).limit(1);

  return NextResponse.json({
    patient: { name: patient.name },
    therapist: { name: therapist?.name ?? "Seu terapeuta" },
    nextSession: next ? { id: next.id, date: (next.date as Date).toISOString(), isOnline: next.isOnline } : null,
  });
}
