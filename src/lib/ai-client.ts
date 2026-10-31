import OpenAI from "openai";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto";

/**
 * IA por terapeuta (BYOK) — o app NÃO carrega chave própria de provedor.
 *
 * Decisão da casa: cada terapeuta cadastra a SUA chave (Configurações → IA). Nada de
 * `OPENAI_API_KEY` compartilhada nem gateway central: o dado clínico vai para o provedor DELE,
 * com a chave DELE. Isso alinha com a §3/§4 (app não carrega chave de provedor) e evita o modo
 * de falha do Kardec (a home caiu quando as chaves compartilhadas morreram).
 *
 * Mesma matriz de provedores que a transcrição (transcribe/route.ts) já usava.
 */
const PROVIDERS: Record<string, { baseURL?: string; chat: string }> = {
  openai: { chat: "gpt-4o-mini" },
  groq: { baseURL: "https://api.groq.com/openai/v1", chat: "llama-3.3-70b-versatile" },
};

export class SemChaveIA extends Error {
  constructor() {
    super("Cadastre sua chave de IA em Configurações para usar este recurso.");
    this.name = "SemChaveIA";
  }
}

export type UserAi = { openai: OpenAI; chatModel: string };

/**
 * O gateway da casa — `ia.reverblabs.com.br`.
 *
 * Uma porta só para a frota: o modelo leve e o pesado rodam na nossa VPS ou atrás dela, e o
 * ouvido (Whisper) também. O app guarda a chave DO GATEWAY, não a de um provedor — é o que a
 * regra da casa pede, e é o que mantém o áudio clínico dentro da nossa infraestrutura.
 *
 * `null` quando não está configurado: o chamador cai na reserva em vez de quebrar.
 */
export function casaAi(): { openai: OpenAI; sttModel: string; chatModel: string } | null {
  const baseURL = process.env.REVERBLABS_AI_BASE_URL;
  const apiKey = process.env.REVERBLABS_AI_KEY;
  if (!baseURL || !apiKey) return null;
  return {
    openai: new OpenAI({ baseURL, apiKey }),
    sttModel: "rl-stt",
    // HEAVY, não leve: a evolução vira texto que a terapeuta assina e o paciente carrega. Modelo
    // pequeno erra com fluência, e aqui o erro é invisível — é a regra §3 da casa.
    chatModel: "rl-heavy",
  };
}

/**
 * Monta o cliente de IA do terapeuta `userId`. Lança `SemChaveIA` se ele não cadastrou chave —
 * o chamador decide como mostrar isso (mensagem amigável, não 500 genérico).
 */
export async function getUserAiClient(userId: string): Promise<UserAi> {
  const [me] = await db
    .select({ provider: users.aiProvider, keyEnc: users.aiKeyEnc })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const cfg = me?.provider ? PROVIDERS[me.provider] : undefined;
  if (!cfg || !me?.keyEnc) throw new SemChaveIA();

  const apiKey = decryptSecret(me.keyEnc); // pode lançar se a chave estiver corrompida
  const openai = new OpenAI({ apiKey, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
  return { openai, chatModel: cfg.chat };
}
