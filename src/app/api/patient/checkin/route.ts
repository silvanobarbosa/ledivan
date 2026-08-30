import { NextResponse } from "next/server";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { db } from "@/db";
import { therapySessions, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/checkin — paciente avisa que chegou (sala de espera). Gated no recurso waitingRoom.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const prefs = await getPreferences(p.userId);
  const [pat] = await db.select({ name: patients.name, ov: patients.featureOverrides }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!resolveFeature(prefs.features?.waitingRoom, parseOverrides(pat?.ov).waitingRoom)) {
    return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });
  }

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const [sess] = await db.select({ id: therapySessions.id }).from(therapySessions)
    .where(and(eq(therapySessions.userId, p.userId), eq(therapySessions.patientId, p.patientId), eq(therapySessions.status, "agendada"), gte(therapySessions.date, start), lte(therapySessions.date, end)))
    .orderBy(asc(therapySessions.date)).limit(1);
  if (!sess) return NextResponse.json({ ok: false, error: "Você não tem sessão marcada para hoje." }, { status: 400 });

  await db.update(therapySessions).set({ patientArrivedAt: new Date() }).where(eq(therapySessions.id, sess.id));
  await pushToTherapist(p.userId, "Paciente chegou 🚪", `${pat?.name ?? "Paciente"} está na sala de espera.`, { type: "arrival", sessionId: sess.id });
  return NextResponse.json({ ok: true });
}
