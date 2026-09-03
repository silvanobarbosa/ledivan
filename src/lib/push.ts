import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

/**
 * Envio de push via Expo Push API (o app é Expo). Um endpoint só; a Expo roteia para FCM
 * (Android) e APNs (iOS). O app registra o token em /api/app/push/register.
 *
 * Nota: no Android o push só CHEGA se o projeto tiver FCM configurado no Expo (chave FCM V1).
 * Sem isso o envio é aceito mas não entrega — é o passo que fica com o dono.
 */
const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type Msg = { to: string; title: string; body: string; data?: Record<string, unknown> };

/** Envia para uma lista de tokens Expo. Remove do banco os tokens que a Expo reportar inválidos. */
export async function enviarPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const validos = tokens.filter((t) => t?.startsWith("ExponentPushToken"));
  if (!validos.length) return { enviados: 0, invalidos: 0 };

  const mensagens: Msg[] = validos.map((to) => ({ to, title, body, data }));
  const invalidar: string[] = [];
  let enviados = 0;

  // Expo aceita até 100 por request
  for (let i = 0; i < mensagens.length; i += 100) {
    const lote = mensagens.slice(i, i + 100);
    const res = await fetch(EXPO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(lote),
    }).then((r) => r.json()).catch(() => null);

    const tickets = res?.data;
    if (Array.isArray(tickets)) {
      tickets.forEach((t: { status?: string; details?: { error?: string } }, idx: number) => {
        if (t.status === "ok") enviados++;
        else if (t.details?.error === "DeviceNotRegistered") invalidar.push(lote[idx].to);
      });
    }
  }

  if (invalidar.length) {
    await db.delete(pushTokens).where(inArray(pushTokens.token, invalidar));
  }
  return { enviados, invalidos: invalidar.length };
}

/** Tokens do TERAPEUTA (aparelhos dele; exclui os do app do paciente). */
export async function tokensDoUsuario(userId: string): Promise<string[]> {
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), isNull(pushTokens.patientId)));
  return rows.map((r) => r.token);
}

/** Tokens de UM paciente (aparelhos do app do paciente). */
export async function tokensDoPaciente(patientId: string): Promise<string[]> {
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens)
    .where(eq(pushTokens.patientId, patientId));
  return rows.map((r) => r.token);
}

/** Todos os tokens de TERAPEUTAS (aviso de atualização do app do terapeuta). */
export async function todosTokens(): Promise<string[]> {
  const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(isNull(pushTokens.patientId));
  return rows.map((r) => r.token);
}

/** Push para o(s) aparelho(s) do terapeuta. Best-effort (nunca lança). */
export async function pushToTherapist(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const tokens = await tokensDoUsuario(userId);
    if (!tokens.length) return { enviados: 0, invalidos: 0 };
    return await enviarPush(tokens, title, body, data);
  } catch {
    return { enviados: 0, invalidos: 0 };
  }
}

/** Push para o(s) aparelho(s) do PACIENTE (app do paciente). Best-effort (nunca lança). */
export async function pushToPatient(patientId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const tokens = await tokensDoPaciente(patientId);
    if (!tokens.length) return { enviados: 0, invalidos: 0 };
    return await enviarPush(tokens, title, body, data);
  } catch {
    return { enviados: 0, invalidos: 0 };
  }
}
