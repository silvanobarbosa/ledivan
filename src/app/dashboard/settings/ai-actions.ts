"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encryptSecret } from "@/lib/crypto";
import { setPreferences } from "@/lib/preferences";

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

/**
 * Liga ou desliga a IA da casa na transcrição.
 *
 * Desligada (padrão), o áudio vai para o provedor da terapeuta com a chave dela, e o app não
 * depende da nossa infraestrutura. Ligada, ela assume essa dependência em troca de não pagar e de
 * o áudio não sair daqui — e a chave dela, se houver, continua como reserva.
 */
export async function setIaDaCasa(ligada: boolean): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  await setPreferences(s.user.id, { iaDaCasa: !!ligada });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
