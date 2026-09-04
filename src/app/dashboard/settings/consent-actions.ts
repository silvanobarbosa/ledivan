"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { consentForms } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Salva/atualiza o termo de consentimento do terapeuta (um por usuário). Bump em updatedAt = nova versão a reaceitar.
export async function saveConsentForm(title: string, body: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const t = (title || "").trim().slice(0, 200);
  const b = (body || "").trim().slice(0, 20000);
  if (!t || !b) return { ok: false };

  await db.insert(consentForms)
    .values({ userId: s.user.id, title: t, body: b, updatedAt: new Date() })
    .onConflictDoUpdate({ target: consentForms.userId, set: { title: t, body: b, updatedAt: sql`now()` } });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Como este arquivo é "use server", todo export vira uma server action invocável por POST
// externo. A versão antiga recebia `userId` e lia o termo daquele id SEM checar sessão — dava
// pra ler o consentimento de outro terapeuta passando o id dele. Agora ignora qualquer
// parâmetro e usa SEMPRE o dono da sessão. O único chamador (settings/page.tsx) já passava o
// próprio id, então nada muda para ele.
export async function getConsentForm() {
  const s = await auth();
  if (!s?.user?.id) return null;
  const [row] = await db.select().from(consentForms).where(eq(consentForms.userId, s.user.id)).limit(1);
  return row ?? null;
}
