// Integração WhatsApp por profissional (multi-instância no Evolution API).
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const URL = () => (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
const KEY = () => process.env.EVOLUTION_API_KEY || "";
const headers = () => ({ "Content-Type": "application/json", apikey: KEY() });

export function isEvolutionConfigured() {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

export function instanceNameFor(userId: string) {
  return `ledivan_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;
}

async function instanceExists(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${URL()}/instance/fetchInstances?instanceName=${name}`, { headers: headers() });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.some((i) => (i.name ?? i.instance?.instanceName) === name);
  } catch {
    return false;
  }
}

// Cria a instância (se preciso) e retorna o QR em base64 para o profissional escanear.
export async function connectInstance(userId: string): Promise<{ ok: boolean; qr?: string; error?: string }> {
  if (!isEvolutionConfigured()) return { ok: false, error: "Servidor WhatsApp não configurado." };
  const name = instanceNameFor(userId);

  try {
    if (!(await instanceExists(name))) {
      // webhook seguro (token na URL) para receber mensagens, se APP_URL configurado
      const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
      const wtoken = process.env.EVOLUTION_WEBHOOK_TOKEN;
      const webhook = appUrl
        ? { webhook: { url: `${appUrl}/api/whatsapp${wtoken ? `?token=${wtoken}` : ""}`, events: ["MESSAGES_UPSERT"] } }
        : {};
      const createRes = await fetch(`${URL()}/instance/create`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ instanceName: name, integration: "WHATSAPP-BAILEYS", qrcode: true, ...webhook }),
      });
      const created = await createRes.json().catch(() => ({}));
      const b64 = created?.qrcode?.base64 || created?.base64;
      await db.update(users).set({ whatsappInstance: name, whatsappConnected: false }).where(eq(users.id, userId));
      if (b64) return { ok: true, qr: b64 };
    }

    // já existe → pega QR atual
    const res = await fetch(`${URL()}/instance/connect/${name}`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    const qr = data?.base64 || data?.qrcode?.base64;
    await db.update(users).set({ whatsappInstance: name }).where(eq(users.id, userId));
    if (qr) return { ok: true, qr };
    // sem QR pode significar já conectado
    return { ok: true };
  } catch (e) {
    console.error("Erro connectInstance:", e);
    return { ok: false, error: "Falha ao conectar ao servidor WhatsApp." };
  }
}

// Estado da conexão. Atualiza whatsappConnected.
export async function checkInstanceState(userId: string): Promise<{ connected: boolean }> {
  if (!isEvolutionConfigured()) return { connected: false };
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const name = user?.whatsappInstance || instanceNameFor(userId);
  try {
    const res = await fetch(`${URL()}/instance/connectionState/${name}`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    const state = data?.instance?.state || data?.state;
    const connected = state === "open";
    await db.update(users).set({ whatsappConnected: connected }).where(eq(users.id, userId));
    return { connected };
  } catch {
    return { connected: false };
  }
}

export async function disconnectInstance(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const name = user?.whatsappInstance;
  if (name && isEvolutionConfigured()) {
    try { await fetch(`${URL()}/instance/logout/${name}`, { method: "DELETE", headers: headers() }); } catch {}
  }
  await db.update(users).set({ whatsappConnected: false }).where(eq(users.id, userId));
}

// Envia uma mensagem pela instância (WhatsApp) do profissional.
export async function sendViaInstance(instance: string, toNumberDigits: string, text: string): Promise<boolean> {
  if (!isEvolutionConfigured() || !instance) return false;
  try {
    const res = await fetch(`${URL()}/message/sendText/${instance}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ number: toNumberDigits, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Envia em nome do profissional (resolve instância pelo userId).
export async function sendWhatsappFromUser(userId: string, toPhone: string, text: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.whatsappConnected || !user.whatsappInstance) return false;
  const digits = (toPhone || "").replace(/\D/g, "");
  const number = digits.length <= 11 ? `55${digits}` : digits;
  if (!number) return false;
  return sendViaInstance(user.whatsappInstance, number, text);
}
