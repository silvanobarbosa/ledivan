// Motor de mensageria (server). Ponto ÚNICO de envio ao paciente: resolve canal (preferido +
// CASCATA de fallback), renderiza a template do evento, dispara pelos adapters do terapeuta
// (WhatsApp do número dele / e-mail dele) e LOGA a entrega em message_log. Respeita opt-out.
import { db } from "@/db";
import { messageLog } from "@/db/schema";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";
import { sendProEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html";
import { renderTemplate, type MsgEvent, type TemplateVars } from "@/lib/messaging/templates";

export type Channel = "whatsapp" | "email";

export type NotifyPatient = {
  id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  reminderChannel?: string | null; // whatsapp | email | telegram | none
};

export type NotifyInput = {
  userId: string;                 // terapeuta dono (tenant)
  patient: NotifyPatient;
  event: MsgEvent;
  vars?: Partial<TemplateVars>;
  channels?: Channel[];           // força a ordem (senão usa a preferência + cascata)
};

export type NotifyResult = { ok: boolean; channel?: Channel; skipped?: boolean; tried: { channel: Channel; ok: boolean; error?: string }[] };

const wrapHtml = (text: string) =>
  `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #e7ddd4;border-radius:16px;">
    <h1 style="color:#2b1830;font-size:20px;">Ledivan</h1>
    <p style="color:#1a0f1f;white-space:pre-line;font-size:15px;line-height:1.6;">${escapeHtml(text.replace(/\*/g, ""))}</p>
  </div>`;

// E-mail via Resend (fallback quando o terapeuta não configurou SMTP próprio).
async function sendViaResend(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "Ledivan <onboarding@resend.dev>", to, subject, html: wrapHtml(text) }),
    });
    return res.ok;
  } catch { return false; }
}

async function log(userId: string, patientId: string | null | undefined, event: string, channel: Channel, destination: string | null, ok: boolean, error?: string) {
  await db.insert(messageLog).values({
    userId, patientId: patientId ?? null, event, channel, destination,
    status: ok ? "sent" : "failed", error: error ?? null,
  }).catch(() => {});
}

/** Resolve a ordem de canais: preferido primeiro, depois o outro (cascata). "none" = opt-out. */
function channelOrder(patient: NotifyPatient): Channel[] {
  const pref = (patient.reminderChannel ?? "whatsapp").toLowerCase();
  if (pref === "none") return [];
  const base: Channel[] = pref === "email" ? ["email", "whatsapp"] : ["whatsapp", "email"];
  // só canais com destino
  return base.filter((c) => (c === "whatsapp" ? !!patient.phone : !!patient.email));
}

/**
 * Envia uma mensagem ao paciente pelo melhor canal disponível, com cascata e log.
 * Retorna o canal que entregou (ou skipped se opt-out / sem contato).
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const { userId, patient, event } = input;
  const order = input.channels ?? channelOrder(patient);
  const tried: NotifyResult["tried"] = [];
  if (!order.length) {
    return { ok: false, skipped: true, tried };
  }

  const { subject, body } = renderTemplate(event, { patientName: patient.name, ...input.vars });

  for (const channel of order) {
    const dest = channel === "whatsapp" ? patient.phone! : patient.email!;
    let ok = false, error: string | undefined;
    try {
      if (channel === "whatsapp") {
        ok = await sendWhatsappFromUser(userId, dest, body);
        if (!ok) error = "whatsapp não entregou";
      } else {
        const r = await sendProEmail(userId, dest, subject, wrapHtml(body));
        ok = r.ok;
        if (!ok) {
          // SMTP do terapeuta ausente/falhou → tenta Resend
          ok = await sendViaResend(dest, subject, body);
          if (!ok) error = r.error || (r.notConfigured ? "sem e-mail configurado" : "falha no e-mail");
        }
      }
    } catch (e) { ok = false; error = String((e as Error).message); }

    await log(userId, patient.id, event, channel, dest, ok, error);
    tried.push({ channel, ok, error });
    if (ok) return { ok: true, channel, tried };
  }
  return { ok: false, tried };
}
