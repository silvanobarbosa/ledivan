import "server-only";

/**
 * QUEM OUVE E QUEM ESCREVE o ditado por campo (doc 76).
 *
 * O documento é explícito no item 9: a funcionalidade tem de ser **nativa do Ledivan**, "sem que
 * o usuário precise contratar, possuir ou conectar uma conta externa de inteligência artificial,
 * fornecer uma chave de API ou realizar qualquer configuração adicional".
 *
 * Isso contradiz, de frente, o que está escrito em `transcricao.ts` desde 31/10: lá a IA da casa
 * foi removida inteira porque "o Ledivan não depende de infraestrutura nossa" — a VPS é ponto
 * único de falha, e `docs/PENDENCIAS.md` do hub registra isso. As duas instruções são do dono, e
 * a do doc 76 é a mais recente.
 *
 * A saída não escolhe um lado: **o gateway da casa primeiro, a chave da terapeuta como reserva**.
 *
 * - Com o gateway configurado, ela não precisa de chave nenhuma — é o que o doc 76 pede.
 * - Com o gateway fora do ar, o ditado continua funcionando pela chave dela, se houver — o
 *   motivo pelo qual a IA da casa tinha sido removida deixa de existir, porque não há mais
 *   dependência dura.
 * - Sem os dois, o microfone não aparece, e a tela diz o porquê. Nunca um botão que falha calado.
 *
 * NADA DE ÁUDIO É GRAVADO, aqui ou em qualquer lugar: o doc 76 proíbe no item 9, e o áudio de
 * sessão é o dado mais sensível que este app chega a tocar. Ele existe durante a requisição e
 * morre com ela.
 */

import OpenAI from "openai";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto";
import { promptDoCampo, textoLimpo, tetoDoCampo, type CampoDoDitado } from "@/lib/ditado";

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

export type MotorDoDitado = {
  /** De onde veio — serve para a mensagem de erro dizer onde olhar. */
  origem: "casa" | "terapeuta";
  cliente: OpenAI;
  stt: string;
  chat: string;
};

/**
 * O motor a usar, nesta ordem. `null` quando não há nenhum — e aí o microfone não existe na tela.
 *
 * O modelo de texto é o PESADO (`rl-heavy`) de propósito: o que sai daqui vira uma AFIRMAÇÃO
 * dentro de um prontuário. Modelo pequeno erra com fluência, e ninguém revisa o que parece certo.
 */
export async function motorDoDitado(userId: string): Promise<MotorDoDitado | null> {
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
  try { apiKey = decryptSecret(me.keyEnc); }
  catch { return null; }

  return {
    origem: "terapeuta",
    cliente: new OpenAI({ apiKey, timeout: 60_000, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) }),
    stt: cfg.stt,
    chat: cfg.chat,
  };
}

/**
 * A fala organizada em texto de prontuário.
 *
 * Se o passo de redação falhar, devolve a TRANSCRIÇÃO CRUA em vez de erro: ter o que foi dito,
 * sem polimento, é melhor do que perder a fala inteira e pedir para a pessoa gravar de novo.
 */
export async function redigirComoProntuario(
  motor: MotorDoDitado,
  bruto: string,
  campo: CampoDoDitado,
  rotulo?: string,
): Promise<string> {
  const fala = bruto.trim();
  if (!fala) return "";
  try {
    const r = await motor.cliente.chat.completions.create({
      model: motor.chat,
      temperature: 0.2,
      max_tokens: campo === "titulo" ? 60 : 1200,
      messages: [
        { role: "system", content: promptDoCampo(campo, rotulo) },
        { role: "user", content: fala },
      ],
    });
    const texto = textoLimpo(r.choices?.[0]?.message?.content ?? "", campo);
    return texto || fala.slice(0, tetoDoCampo(campo));
  } catch {
    return fala.slice(0, tetoDoCampo(campo));
  }
}
