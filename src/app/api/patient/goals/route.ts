import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { treatmentGoals, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/goals — metas terapêuticas do paciente (read-only). Gated no recurso goalsVisible.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const prefs = await getPreferences(p.userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!resolveFeature(prefs.features?.goalsVisible, parseOverrides(pat?.ov).goalsVisible)) {
    return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });
  }

  const goals = await db.select({
    id: treatmentGoals.id,
    title: treatmentGoals.title,
    description: treatmentGoals.description,
    status: treatmentGoals.status,
    progress: treatmentGoals.progress,
    targetDate: treatmentGoals.targetDate,
  }).from(treatmentGoals)
    .where(and(eq(treatmentGoals.userId, p.userId), eq(treatmentGoals.patientId, p.patientId)))
    .orderBy(desc(treatmentGoals.createdAt));

  return NextResponse.json({ ok: true, goals });
}
