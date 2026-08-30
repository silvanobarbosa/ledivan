"use server";

import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";
import { recordOutbound } from "@/lib/messaging/inbox";
import { draftMessage, aiDraftConfigured } from "@/lib/ai-draft";
import { revalidatePath } from "next/cache";

// Responde o paciente pelo WhatsApp do terapeuta e grava no inbox.
export async function replyMessage(input: { patientId?: string | null; contact?: string | null; text: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const text = (input.text || "").trim();
  if (!text) return { ok: false, error: "Mensagem vazia." };

  let phone = input.contact || null;
  const patientId = input.patientId || null;
  if (patientId) {
    const [p] = await db.select({ phone: patients.phone }).from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id))).limit(1);
    if (p?.phone) phone = p.phone;
  }
  if (!phone) return { ok: false, error: "Sem número de destino." };

  const ok = await sendWhatsappFromUser(session.user.id, phone, text);
  if (ok) await recordOutbound(session.user.id, patientId, "whatsapp", text, phone);
  revalidatePath("/dashboard/mensagens");
  return ok ? { ok: true } : { ok: false, error: "Não enviou — confira se seu WhatsApp está conectado em Configurações." };
}

// Sugere uma redação (IA via gateway da casa). O terapeuta SEMPRE revisa antes de enviar.
export async function suggestReply(input: { intent: string; patientName?: string }): Promise<{ ok: boolean; text?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!aiDraftConfigured()) return { ok: false, error: "IA não configurada." };
  const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { name: true } });
  const text = await draftMessage({ intent: input.intent, patientName: input.patientName, therapistName: me?.name ?? undefined });
  return text ? { ok: true, text } : { ok: false, error: "Não consegui sugerir agora." };
}
