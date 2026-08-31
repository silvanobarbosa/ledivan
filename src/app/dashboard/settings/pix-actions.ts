"use server";

import { auth } from "@/auth";
import { setPreferences, getPreferences } from "@/lib/preferences";
import { revalidatePath } from "next/cache";

export type PixConfig = { key: string; name: string; city: string };

// Salva a chave Pix estática do terapeuta (recebe direto, sem gateway).
export async function savePix(cfg: PixConfig): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const key = (cfg.key || "").trim().slice(0, 77);
  const name = (cfg.name || "").trim().slice(0, 25);
  const city = (cfg.city || "").trim().slice(0, 15);
  const prev = await getPreferences(s.user.id);
  await setPreferences(s.user.id, { ...prev, pix: { key, name, city } });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
