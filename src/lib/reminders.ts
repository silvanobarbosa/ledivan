// Envio de lembrete de sessão pelo canal escolhido no cadastro do paciente.
import { sendWhatsapp } from "@/lib/whatsapp";
import { meetingUrl } from "@/lib/therapy";
import { sendProEmail } from "@/lib/email";

type PatientLite = {
  name: string;
  phone: string | null;
  email: string | null;
  reminderChannel: string;
};
type SessionLite = { id: string; date: Date | string; isOnline: boolean };

function buildMessage(p: PatientLite, s: SessionLite) {
  const d = new Date(s.date);
  const quando = d.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  let msg = `Olá, ${p.name}! 🌿\nLembrete da sua sessão: *${quando}*.`;
  if (s.isOnline) msg += `\n\nAtendimento online — entre por aqui no horário:\n${meetingUrl(s.id)}`;
  msg += `\n\nAté lá!`;
  return msg;
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return false;
  const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #e7ddd4;border-radius:16px;">
    <h1 style="color:#2b1830;font-size:20px;">Ledivan+</h1>
    <p style="color:#1a0f1f;white-space:pre-line;font-size:15px;line-height:1.6;">${text.replace(/\*/g, "")}</p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Ledivan+ <onboarding@resend.dev>", to, subject, html }),
  });
  return res.ok;
}

// Retorna true se conseguiu disparar pelo canal. userId = terapeuta dono (tenant).
export async function sendSessionReminder(userId: string, p: PatientLite, s: SessionLite): Promise<boolean> {
  const msg = buildMessage(p, s);
  switch (p.reminderChannel) {
    case "whatsapp":
      if (!p.phone) return false;
      await sendWhatsapp(p.phone, msg);
      return true;
    case "email": {
      if (!p.email) return false;
      // 1º tenta pelo e-mail do próprio profissional (SMTP); senão cai no remetente da plataforma
      const pro = await sendProEmail(userId, p.email, "Lembrete da sua sessão", msg.replace(/\n/g, "<br>"));
      if (pro.ok) return true;
      return sendEmail(p.email, "Lembrete da sua sessão — Ledivan+", msg);
    }
    case "telegram":
      // Requer o Telegram do paciente vinculado (ainda não coletado). Pendente.
      console.warn("Lembrete por Telegram ainda não suportado (sem ID do paciente).");
      return false;
    default:
      return false;
  }
}
