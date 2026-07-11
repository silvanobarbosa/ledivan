/**
 * Central de mensageria — CLIENT (embutir nos apps da frota). O app guarda só um token
 * do gateway (RL_MESSAGING_TOKEN) — nunca creds do Evolution/Telegram. Tudo passa pelo
 * cérebro (roteamento, limite, telemetria). Uso server-side (o token é segredo):
 *
 *   import { createMessaging } from "@/lib/messaging-client";
 *   const msg = createMessaging({ app: "glico", token: process.env.RL_MESSAGING_TOKEN! });
 *   await msg.whatsapp("5511999998888", "Seu pedido saiu para entrega 🚚");
 *   await msg.telegram("123456789", "Alerta interno");
 */
type Opts = { app: string; token: string; gateway?: string };
export type SendResult = { ok: boolean; channel?: string; detail?: string; err?: string };

const DEFAULT_GATEWAY = "https://reverblabs.com.br";

export function createMessaging(opts: Opts) {
  const url = (opts.gateway || process.env.RL_MESSAGING_GATEWAY || DEFAULT_GATEWAY).replace(/\/+$/, "") + "/api/messaging/send";
  async function send(channel: "whatsapp" | "telegram", to: string, text: string): Promise<SendResult> {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: opts.app, token: opts.token, channel, to, text }),
      });
      return (await r.json()) as SendResult;
    } catch (e) {
      return { ok: false, err: String((e as Error).message) };
    }
  }
  return {
    /** WhatsApp — `to` = número (ex "5511999998888"). */
    whatsapp: (to: string, text: string) => send("whatsapp", to, text),
    /** Telegram — `to` = chat_id. */
    telegram: (to: string, text: string) => send("telegram", to, text),
  };
}
