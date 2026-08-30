"use server";

import { auth } from "@/auth";
import { setPreferences, getPreferences } from "@/lib/preferences";
import { revalidatePath } from "next/cache";
import type { FeatureModes } from "@/lib/features";

export async function saveFeatureModes(modes: FeatureModes): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const prev = await getPreferences(s.user.id);
  await setPreferences(s.user.id, { ...prev, features: { ...(prev.features || {}), ...(modes as Record<string, "off" | "all" | "per-patient">) } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveTimerVisibility(value: boolean): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const prev = await getPreferences(s.user.id);
  await setPreferences(s.user.id, { ...prev, timerShowToPatient: value });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
