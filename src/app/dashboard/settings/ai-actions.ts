"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encryptSecret } from "@/lib/crypto";

const PROVIDERS = ["openai", "groq"];

// Salva a chave de IA do próprio terapeuta (BYOK), cifrada em repouso.
// O valor NUNCA volta para a tela — só gravamos e informamos se está configurado.
export async function saveAiKey(provider: string, key: string): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!PROVIDERS.includes(provider)) return { ok: false, error: "Provedor inválido." };
  const k = (key || "").trim();
  if (k.length < 20) return { ok: false, error: "Chave inválida." };

  try {
    await db.update(users).set({ aiProvider: provider, aiKeyEnc: encryptSecret(k) }).where(eq(users.id, s.user.id));
  } catch {
    return { ok: false, error: "Não foi possível salvar a chave (verifique a configuração do servidor)." };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Remove a chave (desliga a transcrição por IA).
export async function clearAiKey(): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.update(users).set({ aiProvider: null, aiKeyEnc: null }).where(eq(users.id, s.user.id));
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
