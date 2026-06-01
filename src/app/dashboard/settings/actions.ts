"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setPreferences, getPreferences, type Integrations } from "@/lib/preferences";
import { normalizePhone } from "@/lib/whatsapp";

// Liga/desliga o vínculo automático de pagamentos de sessão com o financeiro.
export async function setAutoLinkPayments(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await setPreferences(session.user.id, { autoLinkPayments: enabled });
  revalidatePath("/dashboard/settings");
}

// Liga/desliga uma integração (google calendar / gmail / whatsapp) e salva número do WhatsApp.
export async function setIntegration(patch: Integrations) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const prefs = await getPreferences(userId);
  const merged = { ...prefs.integrations, ...patch };
  await setPreferences(userId, { integrations: merged });

  // Mantém users.whatsappId sincronizado (chave de vínculo das mensagens recebidas).
  if ("whatsapp" in patch || "whatsappNumber" in patch) {
    const linkable = merged.whatsapp && merged.whatsappNumber;
    await db.update(users)
      .set({ whatsappId: linkable ? normalizePhone(merged.whatsappNumber!) : null })
      .where(eq(users.id, userId));
  }

  revalidatePath("/dashboard/settings");
}

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const name = formData.get("name") as string;

  await db.update(users)
    .set({ name })
    .where(eq(users.id, session.user.id));

  revalidatePath("/dashboard/settings");
}

export async function generateTelegramCode() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await db.update(users)
    .set({ 
      telegramVerificationCode: code,
      telegramVerificationExpires: expires
    })
    .where(eq(users.id, session.user.id));

  revalidatePath("/dashboard/settings");
  return { code };
}
