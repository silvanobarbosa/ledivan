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

export async function getConsentForm(userId: string) {
  const [row] = await db.select().from(consentForms).where(eq(consentForms.userId, userId)).limit(1);
  return row ?? null;
}
