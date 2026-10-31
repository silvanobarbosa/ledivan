import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rateLimit";
import { decryptSecret } from "@/lib/crypto";
import { tarefaDaFala, TAREFAS } from "@/lib/diva";
import { audioAceitavel, TETO_DO_AUDIO } from "@/lib/transcricao";

/**
 * O OUVIDO DO DIVÃ.
 *
 * Faz uma coisa só: pega o áudio, devolve o TEXTO e a tarefa que esse texto pede. A tarefa sai de
 * `tarefaDaFala`, que é determinística — nenhum modelo escolhe a ação. O modelo transcreve, o app
 * decide, e a tela ainda confirma antes de levar a pessoa a qualquer lugar.
 *
 * Usa a chave da própria terapeuta, como a transcrição da sessão (BYOK): o Ledivan não depende de
 * infraestrutura nossa. Sem chave cadastrada, o Divã continua inteiro — só não ouve.
 *
 * NÃO grava nada. Áudio de comando é fala solta da terapeuta, muitas vezes com o nome de um
 * paciente dentro; guardá-lo seria criar um arquivo de dado clínico que ninguém pediu.
 */

const PROVIDERS: Record<string, { baseURL?: string; stt: string }> = {
  openai: { stt: "whisper-1" },
  groq: { baseURL: "https://api.groq.com/openai/v1", stt: "whisper-large-v3" },
};

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  const userId = session.user.id;

  // Comando de voz é curto e repetido: o teto é generoso, mas existe.
  if (!(await rateLimit(userId, "diva-ouvir", 120, 3600))) {
    return NextResponse.json({ ok: false, error: "Muitos pedidos seguidos. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > TETO_DO_AUDIO) {
    return NextResponse.json({ ok: false, error: "Gravação longa demais." }, { status: 400 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "Gravação longa demais." }, { status: 400 }); }

  const file = form.get("audio") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "Não recebi o áudio." }, { status: 400 });
  const tamanho = audioAceitavel(file.size);
  if (!tamanho.ok) return NextResponse.json({ ok: false, error: tamanho.error }, { status: 400 });

  const [me] = await db.select({ provider: users.aiProvider, keyEnc: users.aiKeyEnc })
    .from(users).where(eq(users.id, userId)).limit(1);
  const cfg = me?.provider ? PROVIDERS[me.provider] : undefined;
  if (!cfg || !me?.keyEnc) {
    return NextResponse.json({ ok: false, error: "Para falar com o Divã, cadastre sua chave de IA em Ajustes." }, { status: 400 });
  }

  let apiKey: string;
  try { apiKey = decryptSecret(me.keyEnc); }
  catch { return NextResponse.json({ ok: false, error: "Não foi possível ler sua chave de IA. Cadastre novamente." }, { status: 500 }); }

  try {
    const openai = new OpenAI({ apiKey, timeout: 45_000, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
    const r = await openai.audio.transcriptions.create({
      file,
      model: cfg.stt,
      language: "pt",
      // A dica é o VOCABULÁRIO do próprio Divã: ele erra menos no que ele mesmo sabe fazer.
      prompt: `Comandos possíveis: ${TAREFAS.map((t) => t.rotulo).join("; ")}.`,
    });

    const fala = (r.text ?? "").trim();
    const tarefa = tarefaDaFala(fala);
    return NextResponse.json({
      ok: true,
      fala,
      tarefa: tarefa ? { id: tarefa.id, rotulo: tarefa.rotulo, rota: tarefa.rota, dica: tarefa.dica ?? null } : null,
    });
  } catch (e) {
    console.error("Divã não conseguiu ouvir:", e);
    return NextResponse.json({ ok: false, error: "Não consegui ouvir agora. Tente de novo." }, { status: 500 });
  }
}
