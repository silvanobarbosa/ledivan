// SMS — canal de FALLBACK (custa dinheiro; só quando WhatsApp/e-mail falham). Provider plugável
// via SMS_PROVIDER (zenvia | twilio). Sem env do provider → smsConfigured()=false → o motor pula.
// Recomendado no BR: Zenvia (remetente registrado). Best-effort: nunca lança.

type Provider = "zenvia" | "twilio";

function provider(): Provider | null {
  const p = (process.env.SMS_PROVIDER || "").toLowerCase();
  if (p === "zenvia" || p === "twilio") return p;
  return null;
}

export function smsConfigured(): boolean {
  const p = provider();
  if (p === "zenvia") return !!(process.env.ZENVIA_TOKEN && process.env.SMS_FROM);
  if (p === "twilio") return !!(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.SMS_FROM);
  return false;
}

/** Normaliza p/ E.164 BR: só dígitos, garante DDI 55 (assume Brasil quando vem DDD+número). */
function toE164(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = "55" + d; // DDD+número → +55
  return d;
}

async function viaZenvia(toDigits: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.zenvia.com/v2/channels/sms/messages", {
      method: "POST",
      headers: { "X-API-TOKEN": process.env.ZENVIA_TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.SMS_FROM, to: toDigits, contents: [{ type: "text", text }] }),
    });
    return res.ok;
  } catch { return false; }
}

async function viaTwilio(toDigits: string, text: string): Promise<boolean> {
  try {
    const sid = process.env.TWILIO_SID!;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_TOKEN}`).toString("base64");
    const body = new URLSearchParams({ To: `+${toDigits}`, From: process.env.SMS_FROM!, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return res.ok;
  } catch { return false; }
}

/** Envia um SMS. `to` = telefone (qualquer formato). Sem provider configurado → false. */
export async function sendSms(to: string, text: string): Promise<boolean> {
  const p = provider();
  if (!p || !smsConfigured()) return false;
  const digits = toE164(to);
  if (digits.length < 12) return false; // número inválido
  // SMS é curto: corta em 480 chars (3 segmentos) e tira markdown do WhatsApp.
  const msg = text.replace(/\*/g, "").slice(0, 480);
  return p === "zenvia" ? viaZenvia(digits, msg) : viaTwilio(digits, msg);
}
