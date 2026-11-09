import "server-only";

/**
 * QUEM ATENDE OS PEDIDOS DE IA do app — a casa primeiro, a chave da terapeuta como reserva.
 *
 * A política nasceu no ditado (doc 76): a funcionalidade tem de ser **nativa do Ledivan**, "sem
 * que o usuário precise contratar, possuir ou conectar uma conta externa de inteligência
 * artificial, fornecer uma chave de API ou realizar qualquer configuração adicional". O doc 9
 * estendeu a mesma exigência ao Relatório de Acompanhamento Terapêutico, e por isso a escolha do
 * motor saiu do ditado e virou este módulo: duas telas que resolvem IA de jeitos diferentes é o
 * começo de uma delas parar de funcionar sem ninguém notar.
 *
 * - Com o gateway da casa configurado, ela não precisa de chave nenhuma.
 * - Com o gateway fora do ar, o recurso continua pela chave dela, se houver — assim a VPS não é
 *   ponto único de falha, que era a objeção registrada em `transcricao.ts`.
 * - Sem os dois, o recurso não aparece (ou avisa). Nunca um botão que falha calado.
 *
 * O modelo de texto é o PESADO (`rl-heavy`) de propósito: o que sai daqui vira AFIRMAÇÃO dentro
 * de um prontuário. Modelo pequeno erra com fluência, e ninguém revisa o que parece certo.
 */

import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

const PROVIDERS: Record<string, { baseURL?: string; stt: string; chat: string }> = {
  openai: { stt: "whisper-1", chat: "gpt-4o-mini" },
  groq: { baseURL: "https://api.groq.com/openai/v1", stt: "whisper-large-v3", chat: "llama-3.3-70b-versatile" },
};

const GATEWAY_BASE = () => (process.env.REVERBLABS_AI_BASE_URL || "").replace(/\/+$/, "");
const GATEWAY_KEY = () => process.env.REVERBLABS_AI_KEY || "";

/** O gateway da casa está configurado neste ambiente? */
export function gatewayDaCasaLigado(): boolean {
  return !!(GATEWAY_BASE() && GATEWAY_KEY());
}

export type MotorDeIA = {
  /** De onde veio — serve para a mensagem de erro dizer onde olhar. */
  origem: "casa" | "terapeuta";
  cliente: OpenAI;
  stt: string;
  chat: string;
};

/** O motor a usar, nesta ordem. `null` quando não há nenhum. */
export async function motorDeIA(userId: string): Promise<MotorDeIA | null> {
  if (gatewayDaCasaLigado()) {
    return {
      origem: "casa",
      cliente: new OpenAI({ apiKey: GATEWAY_KEY(), baseURL: GATEWAY_BASE(), timeout: 60_000 }),
      stt: process.env.REVERBLABS_AI_STT || "rl-stt",
      chat: process.env.REVERBLABS_AI_MODEL || "rl-heavy",
    };
  }

  const [me] = await db.select({ provider: users.aiProvider, keyEnc: users.aiKeyEnc })
    .from(users).where(eq(users.id, userId)).limit(1);
  const cfg = me?.provider ? PROVIDERS[me.provider] : undefined;
  if (!cfg || !me?.keyEnc) return null;

  let apiKey: string;
  // A chave guardada não abriu. O que não abre aqui ainda é segredo: nada do blob vai para a
  // mensagem nem para o log.
  try { apiKey = decryptSecret(me.keyEnc); }
  catch { return null; }

  return {
    origem: "terapeuta",
    cliente: new OpenAI({ apiKey, timeout: 60_000, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) }),
    stt: cfg.stt,
    chat: cfg.chat,
  };
}
