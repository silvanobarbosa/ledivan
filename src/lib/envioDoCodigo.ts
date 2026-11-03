import "server-only";

/**
 * POR ONDE O CÓDIGO DE ACESSO VIAJA (doc 55): Telegram e e-mail.
 *
 * Cada função devolve `true` só quando a mensagem SAIU. Isso importa: a rota só grava o código
 * depois que algum canal confirmou entrega. Um código gravado sem envio deixa a pessoa olhando
 * uma tela que pede algo que nunca vai chegar — e ela não tem como saber a diferença.
 *
 * Nenhum erro daqui sobe para a tela. A resposta ao pedido de código é sempre a mesma, exista a
 * conta ou não; detalhar a falha de envio diria que a conta existe.
 */

import { getBot } from "@/lib/telegram";
import { sendProEmail } from "@/lib/email";

export async function enviarCodigoPorTelegram(telegramId: string, texto: string): Promise<boolean> {
  try {
    await getBot().telegram.sendMessage(telegramId, texto);
    return true;
  } catch (e) {
    console.error("[codigo] telegram falhou:", e instanceof Error ? e.message.slice(0, 120) : "erro");
    return false;
  }
}

/** E-mail transacional da casa (Resend). É o caminho que não depende de ela ter configurado SMTP. */
async function porResend(para: string, texto: string): Promise<boolean> {
  const chave = process.env.AUTH_RESEND_KEY;
  if (!chave) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Ledivan <onboarding@resend.dev>",
        to: para,
        subject: "Seu código de acesso ao Ledivan",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h1 style="color:#0b3d91;font-size:20px;margin:0 0 12px">Ledivan</h1>
          <p style="color:#122749;font-size:15px;line-height:1.6;white-space:pre-line">${texto}</p>
        </div>`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * O e-mail do código. Resend primeiro; o SMTP dela como reserva.
 *
 * A ordem é essa de propósito: quem está tentando ENTRAR pode nem ter configurado SMTP ainda —
 * e mandar o código de acesso pelo servidor de e-mail dela, que só funciona depois de ela
 * entrar, é um círculo fechado.
 */
export async function enviarCodigoPorEmail(userId: string, para: string, texto: string): Promise<boolean> {
  if (await porResend(para, texto)) return true;
  try {
    const r = await sendProEmail(userId, para, "Seu código de acesso ao Ledivan",
      `<p style="white-space:pre-line">${texto}</p>`);
    return !!r.ok;
  } catch {
    return false;
  }
}
