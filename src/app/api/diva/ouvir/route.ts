import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients, therapySessions, users } from "@/db/schema";
import { and, eq, gte, ne } from "drizzle-orm";
import { rateLimit } from "@/lib/rateLimit";
import { decryptSecret } from "@/lib/crypto";
import { tarefaDaFala, TAREFAS } from "@/lib/diva";
import { previaDoComando, type CobrancaParaPagar } from "@/lib/previaDoComando";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import { horaDeParede } from "@/lib/horaLocal";
import { audioAceitavel, dicaQueCabe, TETO_DO_AUDIO } from "@/lib/transcricao";

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

  /**
   * As sessões futuras vêm ANTES de transcrever (doc do dia 01/11).
   *
   * Elas já eram necessárias depois, para a prévia do comando. Lidas aqui, servem também para
   * ORDENAR a dica: quem tem atendimento marcado é quem ela vai nomear, e a dica tem teto —
   * quando precisa cortar, corta os nomes menos prováveis.
   */
  const agora = new Date();
  const futuras = await db.select({ id: therapySessions.id, patientId: therapySessions.patientId, date: therapySessions.date })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, agora), ne(therapySessions.status, "cancelada")));

  /**
   * A ORDEM dos nomes na dica: primeiro quem tem atendimento marcado, do mais próximo ao mais
   * distante; depois os demais. Quando a dica não couber inteira, é a cauda que cai — e a cauda
   * passa a ser quem ela tinha menos chance de nomear.
   */
  const proximaDe = new Map<string, number>();
  for (const f of futuras) {
    const t = new Date(f.date).getTime();
    const atual = proximaDe.get(f.patientId);
    if (atual == null || t < atual) proximaDe.set(f.patientId, t);
  }
  const nomesParaADica = [...meusPacientes]
    .sort((a, b) => (proximaDe.get(a.id) ?? Infinity) - (proximaDe.get(b.id) ?? Infinity))
    .map((p) => p.nome);

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
       * escolher certo.
       *
       * O corte é por CARACTERES, não por quantidade de nomes: era "80 nomes", que não tem
       * relação com o que o provedor mede. Com 32 pacientes a dica passou de 1.200 caracteres e o
       * Groq passou a recusar TODO comando de voz com 400 (medido em 01/11). Ver `dicaQueCabe`.
       */
      prompt: dicaQueCabe(
        `Verbos: anotar, anota, marcar, marca, agendar, cancelar, cancela, desmarcar, lançar pagamento, dar baixa, recebi, pagou, pix. Comandos: ${TAREFAS.map((t) => t.rotulo).join("; ")}.`,
        nomesParaADica,
      ),
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

    const opcoes = { agora, sessoesDoPaciente: (id: string) => porPaciente.get(id) ?? [] };
    let comando = previaDoComando(fala, meusPacientes, opcoes);

    /**
     * AS COBRANÇAS vêm depois de saber de QUEM — e por isso a leitura roda duas vezes.
     *
     * `geralDoPaciente` é o motor inteiro da guia Geral; rodá-lo para os 30 pacientes dela a cada
     * comando de voz seria pagar trinta vezes por um dado que só interessa de um. A primeira
     * passada (pura, sem banco) diz quem ela nomeou; só então o motor roda, para esse um.
     */
    if (comando?.acao === "pagar" && comando.paciente.tipo === "um") {
      const alvo = comando.paciente.paciente.id;
      const geral = await geralDoPaciente(userId, alvo);
      const cobrancas: CobrancaParaPagar[] = (geral?.linhas ?? [])
        .flatMap((l) => (l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : []))
        .map((c) => {
          const vencimento = c.vencimento ? new Date(horaDeParede(c.vencimento)) : null;
          return {
            chave: c.chave,
            vencimento,
            falta: Number(c.falta) || 0,
            ano: vencimento ? vencimento.getFullYear() : agora.getFullYear(),
          };
        });
      comando = previaDoComando(fala, meusPacientes, { ...opcoes, cobrancasDoPaciente: () => cobrancas });
    }

    const tarefa = comando ? null : tarefaDaFala(fala);
    return NextResponse.json({
      ok: true,
      fala,
      comando,
      tarefa: tarefa
        ? { id: tarefa.id, rotulo: tarefa.rotulo, rota: tarefa.rota, dica: tarefa.dica ?? null, soLeva: tarefa.soLeva ?? false }
        : null,
    });
  } catch (e) {
    console.error("Divã não conseguiu ouvir:", e);
    /**
     * O MOTIVO, quando o provedor diz qual — e quando ele é acionável por ela.
     *
     * "Não consegui ouvir agora" escondeu por dias um 400 de dica longa demais: a terapeuta
     * achou que era o celular. Chave recusada e limite de uso são coisas que ELA resolve, e
     * dizer qual é poupa a viagem inteira. O resto continua genérico: detalhe de provedor na
     * tela não ajuda ninguém e pode vazar informação da conta.
     */
    const status = (e as { status?: number })?.status;
    const erro = status === 401 || status === 403
      ? "Sua chave de IA foi recusada pelo provedor. Confira em Ajustes."
      : status === 429
        ? "Seu provedor de IA está limitando os pedidos agora. Tente em alguns minutos."
        : "Não consegui ouvir agora. Tente de novo.";
    return NextResponse.json({ ok: false, error: erro }, { status: 500 });
  }
}
