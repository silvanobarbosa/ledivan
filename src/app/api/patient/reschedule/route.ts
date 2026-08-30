import { NextResponse } from "next/server";
import { and, eq, gte, asc } from "drizzle-orm";
import { db } from "@/db";
import { therapySessions, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/reschedule — paciente pede remarcação da próxima sessão. Gated no recurso rescheduleApp.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const prefs = await getPreferences(p.userId);
  const [pat] = await db.select({ name: patients.name, ov: patients.featureOverrides }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!resolveFeature(prefs.features?.rescheduleApp, parseOverrides(pat?.ov).rescheduleApp)) {
    return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });
  }

  const [sess] = await db.select({ id: therapySessions.id }).from(therapySessions)
    .where(and(eq(therapySessions.userId, p.userId), eq(therapySessions.patientId, p.patientId), eq(therapySessions.status, "agendada"), gte(therapySessions.date, new Date())))
    .orderBy(asc(therapySessions.date)).limit(1);
  if (!sess) return NextResponse.json({ ok: false, error: "Você não tem sessão marcada." }, { status: 400 });

  await db.update(therapySessions).set({ rescheduleRequestedAt: new Date() }).where(eq(therapySessions.id, sess.id));
  await pushToTherapist(p.userId, "Pedido de remarcação 🔁", `${pat?.name ?? "Paciente"} pediu para remarcar.`, { type: "reschedule", sessionId: sess.id });
  return NextResponse.json({ ok: true });
}
