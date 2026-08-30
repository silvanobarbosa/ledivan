"use server";

import { db } from "@/db";
import { patients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getPreferences } from "@/lib/preferences";
import { FEATURES, parseOverrides, type FeatureKey } from "@/lib/features";
import { revalidatePath } from "next/cache";

// Config de recursos DESTE paciente: só os recursos que o terapeuta pôs em "por paciente" + os overrides atuais.
export async function getPatientFeatureConfig(patientId: string): Promise<{ perPatient: { key: FeatureKey; label: string }[]; overrides: Record<string, boolean> }> {
  const s = await auth();
  if (!s?.user?.id) return { perPatient: [], overrides: {} };
  const prefs = await getPreferences(s.user.id);
  const perPatient = FEATURES.filter((f) => prefs.features?.[f.key] === "per-patient").map((f) => ({ key: f.key, label: f.label }));
  const [p] = await db.select({ ov: patients.featureOverrides }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, s.user.id))).limit(1);
  return { perPatient, overrides: parseOverrides(p?.ov) };
}

export async function setPatientOverride(patientId: string, key: FeatureKey, value: boolean): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const [p] = await db.select({ ov: patients.featureOverrides }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, s.user.id))).limit(1);
  if (!p) return { ok: false };
  const ov = parseOverrides(p.ov);
  ov[key] = value;
  await db.update(patients).set({ featureOverrides: JSON.stringify(ov) }).where(eq(patients.id, patientId));
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}
