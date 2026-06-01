"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { setPreferences, getPreferences, type Integrations } from "@/lib/preferences";
import { normalizePhone } from "@/lib/whatsapp";
import { detectSmtp, verifySmtp } from "@/lib/email";
import { encryptSecret } from "@/lib/crypto";
import { connectInstance, checkInstanceState, disconnectInstance } from "@/lib/whatsappEvolution";

// WhatsApp do profissional (Evolution): conectar (QR), checar estado, desconectar.
export async function connectWhatsapp() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  return connectInstance(session.user.id);
}

export async function checkWhatsapp() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const r = await checkInstanceState(session.user.id);
  revalidatePath("/dashboard/settings");
  return r;
}

export async function disconnectWhatsapp() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await disconnectInstance(session.user.id);
  revalidatePath("/dashboard/settings");
}

// Detecta/valida/salva o SMTP do próprio profissional (e-mail ao paciente sai do e-mail dele).
export async function testAndSaveSmtp(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const email = (formData.get("email") as string)?.trim();
  const pass = (formData.get("pass") as string) || "";
  const fromName = ((formData.get("fromName") as string) || "").trim() || null;
  if (!email || !pass) return { ok: false, error: "Informe e-mail e senha de app." };

  // override avançado opcional
  const hostOv = ((formData.get("host") as string) || "").trim();
  const portOv = parseInt((formData.get("port") as string) || "");
  let cfg = detectSmtp(email);
  if (hostOv) cfg = { host: hostOv, port: portOv || 587, secure: portOv === 465 };
  if (!cfg) return { ok: false, error: "Não consegui detectar o servidor. Use a opção avançada." };

  try {
    await verifySmtp({ ...cfg, user: email, pass });
  } catch {
    return { ok: false, error: "Não consegui conectar. Confira o e-mail e a senha de app (não use a senha normal)." };
  }

  await db.update(users).set({
    smtpHost: cfg.host,
    smtpPort: cfg.port,
    smtpSecure: cfg.secure,
    smtpUser: email,
    smtpPassEnc: encryptSecret(pass),
    smtpFromName: fromName,
    emailConfigured: true,
  }).where(eq(users.id, userId));

  revalidatePath("/dashboard/settings");
  return { ok: true, host: cfg.host, port: cfg.port };
}

export async function disableSmtp() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await db.update(users).set({ emailConfigured: false, smtpPassEnc: null }).where(eq(users.id, session.user.id));
  revalidatePath("/dashboard/settings");
}

// Liga/desliga o vínculo automático de pagamentos de sessão com o financeiro.
export async function setAutoLinkPayments(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await setPreferences(session.user.id, { autoLinkPayments: enabled });
  revalidatePath("/dashboard/settings");
}

// Liga/desliga a transcrição de sessão por IA (opt-in do terapeuta).
export async function setTranscriptionEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await setPreferences(session.user.id, { transcriptionEnabled: enabled });
  revalidatePath("/dashboard/settings");
}

// Define/atualiza o slug público de autoagendamento (/agendar/<slug>).
export async function setBookingSlug(raw: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  let slug = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!slug) return { ok: false, error: "Informe um nome para o link." };

  // garante unicidade (ignora o próprio usuário)
  const existing = await db.query.users.findFirst({ where: eq(users.bookingSlug, slug) });
  if (existing && existing.id !== userId) {
    slug = `${slug}-${userId.slice(0, 4)}`;
  }

  await db.update(users).set({ bookingSlug: slug }).where(eq(users.id, userId));
  revalidatePath("/dashboard/settings");
  return { ok: true, slug };
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
