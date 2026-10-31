import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients, therapySessions, users } from "@/db/schema";
import { and, eq, gte, ne } from "drizzle-orm";
import { rateLimit } from "@/lib/rateLimit";
import { decryptSecret } from "@/lib/crypto";
import { tarefaDaFala, TAREFAS } from "@/lib/diva";
import { previaDoComando } from "@/lib/previaDoComando";
import { horaDeParede } from "@/lib/horaLocal";
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

  const meusPacientes = await db.select({ id: patients.id, nome: patients.name })
    .from(patients)
    .where(and(eq(patients.userId, userId), ne(patients.patientStatus, "inativo")));

  try {
    const openai = new OpenAI({ apiKey, timeout: 45_000, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });
    const r = await openai.audio.transcriptions.create({
      file,
      model: cfg.stt,
      language: "pt",
      /**
       * A dica: o vocabulário do Divã MAIS os nomes dos pacientes dela.
       *
       * Sem os nomes, "Kleber" virou "PB Er" (medido em 31/10) e nenhum comando achava ninguém.
       * Mandar a lista aqui é legítimo — e é o oposto do que vale na transcrição de SESSÃO, onde
       * a lista inteira empurraria o nome de um paciente para dentro do prontuário de outro. Aqui
       * não se escreve o que foi dito: ESCOLHE-SE de um conjunto fechado, e a dica só ajuda a
       * escolher certo. Limitada a 80 nomes para não estourar o campo.
       */
      prompt: `Verbos: anotar, anota, marcar, marca, agendar, cancelar, cancela, desmarcar. Comandos: ${TAREFAS.map((t) => t.rotulo).join("; ")}. Pacientes: ${meusPacientes.slice(0, 80).map((p) => p.nome).join(", ")}.`,
    });

    const fala = (r.text ?? "").trim();

    /**
     * COMANDO vem antes de NAVEGAÇÃO.
     *
     * "marca a Marcela quinta às 16h" contém "marcar", que no catálogo de navegação abre a janela
     * de novo atendimento. Mas ela disse mais do que isso: disse quem e quando. Ler primeiro o
     * comando é o que separa "abrir a tela" de "chegar com a tela preenchida".
     *
     * Nada é escrito aqui. A prévia diz o que foi entendido e o que falta; quem executa são as
     * ações, depois de ela confirmar na tela.
     */
    const agora = new Date();
    const futuras = await db.select({ id: therapySessions.id, patientId: therapySessions.patientId, date: therapySessions.date })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, agora), ne(therapySessions.status, "cancelada")));
    /**
     * `horaDeParede` ANTES de virar Date — como no resto do app.
     *
     * A coluna é hora de parede e o driver a devolve como se fosse UTC: lida crua, uma sessão das
     * 15h aparecia como 12h na confirmação (medido em 31/10). Num cartão cujo trabalho é ela
     * reconhecer o atendimento antes de cancelá-lo, mostrar a hora errada é pior do que não
     * mostrar nada. Ver [[licao-meia-noite-vira-dia-anterior]].
     */
    const porPaciente = new Map<string, { id: string; quando: Date }[]>();
    const paraParede = futuras
      .map((s) => ({ id: s.id, patientId: s.patientId, quando: new Date(horaDeParede(s.date)) }))
      .sort((a, b) => a.quando.getTime() - b.quando.getTime());
    for (const s of paraParede) {
      const lista = porPaciente.get(s.patientId) ?? [];
      lista.push({ id: s.id, quando: s.quando });
      porPaciente.set(s.patientId, lista);
    }

    const comando = previaDoComando(fala, meusPacientes, {
      agora,
      sessoesDoPaciente: (id) => porPaciente.get(id) ?? [],
    });

    const tarefa = comando ? null : tarefaDaFala(fala);
    return NextResponse.json({
      ok: true,
      fala,
      comando,
      tarefa: tarefa ? { id: tarefa.id, rotulo: tarefa.rotulo, rota: tarefa.rota, dica: tarefa.dica ?? null } : null,
    });
  } catch (e) {
    console.error("Divã não conseguiu ouvir:", e);
    return NextResponse.json({ ok: false, error: "Não consegui ouvir agora. Tente de novo." }, { status: 500 });
  }
}
