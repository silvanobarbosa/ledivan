"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { patientRecords, patients, sessionPayments, therapySessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { agoraParede } from "@/lib/horaLocal";
import { quandoDoRecibo, type ReciboDaVoz } from "@/lib/reciboDaVoz";
import { pagadorSugerido } from "@/lib/pagadorSugerido";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import { lancarPagamento } from "./patients/[id]/geral-actions";

/**
 * O QUE A VOZ EXECUTA — e só depois de ela confirmar na tela.
 *
 * Duas ações, e as duas recebem IDS, nunca texto. A fala já foi lida, o paciente já foi resolvido
 * contra a lista dela e a sessão já foi escolhida — tudo isso aconteceu ANTES, na prévia, e passou
 * pela vista dela. Aqui não se interpreta nada: se chegasse um nome para resolver, haveria um
 * segundo lugar decidindo quem é o paciente, e dois lugares decidindo é um lugar a mais para
 * errar.
 *
 * Reservar não está aqui de propósito: a voz PREENCHE a janela de Novo atendimento e a terapeuta
 * aperta Agendar. Criar sessão por voz pularia as perguntas de sequência do pacote e modalidade,
 * que têm consequência em dinheiro.
 */

/** A anotação ditada. Aditiva, sem dinheiro, e desfazível apagando o registro. */
export async function anotarPorVoz(patientId: string, texto: string): Promise<{ ok: boolean; error?: string; recibo?: ReciboDaVoz }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const conteudo = (texto ?? "").trim();
  if (!conteudo) return { ok: false, error: "Não entendi o que anotar." };

  // O paciente tem de ser DELA. O id veio da tela, e tela é conveniência, não fronteira.
  const paciente = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!paciente) return { ok: false, error: "Paciente não encontrado." };

  const [gravado] = await db.insert(patientRecords).values({
    userId,
    patientId,
    type: "evolucao",
    // O título diz de onde veio: quem reler o prontuário daqui a um ano precisa saber que foi ditado.
    title: "Anotação por voz",
    content: conteudo,
    createdAt: agoraParede(),
  }).returning({ id: patientRecords.id, content: patientRecords.content, createdAt: patientRecords.createdAt });

  revalidatePath(`/dashboard/patients/${patientId}`);
  // O recibo sai do que o banco devolveu, não do que mandamos gravar.
  if (!gravado) return { ok: false, error: "A anotação não foi gravada. Tente de novo." };
  return {
    ok: true,
    recibo: {
      comando: "anotar no prontuário",
      paciente: paciente.name,
      gravado: `Anotação por voz: “${gravado.content}”`,
      quando: quandoDoRecibo(gravado.createdAt),
      id: gravado.id,
    },
  };
}

/**
 * O cancelamento ditado.
 *
 * Recebe o id da SESSÃO, nunca "a de amanhã": qual sessão é foi decidido na prévia e mostrado a
 * ela por extenso — paciente, dia e hora — antes do toque. Desmarcar a pessoa errada é o pior que
 * esta voz pode fazer, e é por isso que ela não escolhe aqui.
 */
export async function cancelarPorVoz(sessionId: string): Promise<{ ok: boolean; error?: string; recibo?: ReciboDaVoz }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { ok: false, error: "Atendimento não encontrado." };
  if (atual.status === "cancelada") return { ok: false, error: "Esse atendimento já está cancelado." };

  await db.update(therapySessions)
    .set({ status: "cancelada" })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)));

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);

  /**
   * O recibo lê o estado DEPOIS do update — e lê o status, que é a coisa que mudou.
   *
   * Um `ok: true` aqui provaria apenas que o update não deu erro. Cancelar é a ação mais pesada da
   * voz (desmarca alguém de verdade): ela merece a prova de que a linha está, agora, cancelada.
   */
  const [depois] = await db.select({
    status: therapySessions.status,
    date: therapySessions.date,
    paciente: patients.name,
  })
    .from(therapySessions)
    .innerJoin(patients, eq(patients.id, therapySessions.patientId))
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)))
    .limit(1);

  if (depois?.status !== "cancelada") return { ok: false, error: "O cancelamento não foi gravado. Tente de novo." };
  return {
    ok: true,
    recibo: {
      comando: "cancelar atendimento",
      paciente: depois.paciente,
      gravado: `Atendimento de ${quandoDoRecibo(depois.date)} está CANCELADO`,
      quando: quandoDoRecibo(agoraParede()),
      id: sessionId,
    },
  };
}

/**
 * O PAGAMENTO DITADO — a voz grava, por decisão do dono (02/11).
 *
 * Até aqui ela só levava à tela com o formulário aberto e preenchido, e quem apertava era a
 * terapeuta. O relato que mudou isso: ela ditou "um pagamento de 400 reais feito pela Talita, em
 * 31/10", confirmou no Divã, viu a carteira abrir — e nada foi lançado. Ela saiu achando que
 * tinha lançado. Pedido completo que termina em tela aberta é pedido que a pessoa dá por
 * atendido; ver [[licao-rebaixamento-silencioso]].
 *
 * Três coisas seguram o risco de dinheiro escrito por voz:
 *
 * 1. **Não existe motor novo.** Quem lança é `lancarPagamento`, o mesmo do formulário — com as
 *    MESMAS escolhas padrão da tela (forma pix quando ela não diz, sobra vira crédito, diferença
 *    fica nesta cobrança). Um segundo caminho de dinheiro seria um segundo lugar para divergir.
 * 2. **A cobrança e o valor já passaram pela vista dela**, por extenso, na prévia ("vence em
 *    01/11 · faltam R$ 400,00"), antes do toque. Aqui nada é interpretado.
 * 3. **O recibo é lido de volta do banco**, não narrado: id, valor e data saem da linha que ficou
 *    gravada, e o que SOBROU em aberto é dito.
 */
export async function pagarPorVoz(entrada: {
  patientId: string;
  cobrancaChave: string;
  valor: number;
  forma?: string | null;
  /** A data dita ("em 31/10"), em ISO. Ausente = hoje, como no formulário. */
  dataIso?: string | null;
}): Promise<{ ok: boolean; error?: string; recibo?: ReciboDaVoz }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const paciente = await db.query.patients.findFirst({
    where: and(eq(patients.id, entrada.patientId), eq(patients.userId, userId)),
  });
  if (!paciente) return { ok: false, error: "Paciente não encontrado." };

  const valor = Number(entrada.valor);
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "Não entendi o valor." };

  /**
   * O PAGADOR sai do cadastro, pela mesma regra da tela (doc 72, `pagadorSugerido`).
   *
   * Há responsável cadastrado: o par nome+CPF é dele. CPF em branco é o cadastro dizendo que não
   * sabe — não é permissão para usar o CPF do paciente.
   */
  const pagador = pagadorSugerido({
    responsavelNome: paciente.guardianName,
    responsavelCpf: paciente.guardianCpf,
    pacienteNome: paciente.name,
    pacienteCpf: paciente.cpf,
  });

  const dia = entrada.dataIso ? new Date(entrada.dataIso) : agoraParede();
  if (Number.isNaN(dia.getTime())) return { ok: false, error: "Não entendi a data do pagamento." };
  const data = `${dia.getFullYear()}-${doisDigitos(dia.getMonth() + 1)}-${doisDigitos(dia.getDate())}`;

  // O que já existia ANTES — para saber, depois, exatamente qual linha nasceu deste comando.
  const antes = new Set(
    (await db.select({ id: sessionPayments.id }).from(sessionPayments)
      .where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, paciente.id))))
      .map((p) => p.id),
  );

  const r = await lancarPagamento({
    patientId: paciente.id,
    cobrancaChave: entrada.cobrancaChave,
    data,
    pagoPor: pagador.nome,
    pagoPorCpf: pagador.cpf,
    // Os padrões são os do FORMULÁRIO, não outros: a voz não pode ser uma segunda política.
    metodo: entrada.forma || "pix",
    valor: String(valor),
    quitarDiferenca: false,
    diferencaOutraData: true,
    creditarExcedente: true,
  });
  if (!r.ok) return { ok: false, error: r.error ?? "Não foi possível lançar o pagamento." };

  const depoisDoLancamento = await db.select({
    id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date,
  }).from(sessionPayments)
    .where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, paciente.id)));
  const novo = depoisDoLancamento.find((p) => !antes.has(p.id));
  // O motor disse ok e não há linha nova: não afirme que gravou. É o caso que a leitura de volta
  // existe para pegar.
  if (!novo) return { ok: false, error: "O pagamento não foi encontrado depois de lançado. Confira na carteira." };

  /**
   * O que FICOU da cobrança entra no recibo.
   *
   * Lançar R$ 400 numa cobrança de R$ 500 é um pagamento válido e deixa R$ 100 em aberto. Se o
   * recibo dissesse só "pago", ela sairia achando que quitou — o mesmo mal-entendido que trouxe
   * este código à existência, com o sinal trocado.
   */
  const geral = await geralDoPaciente(userId, paciente.id);
  const cobranca = (geral?.linhas ?? [])
    .flatMap((l) => (l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : []))
    .find((c) => c.chave === entrada.cobrancaChave);
  const falta = Number(cobranca?.falta ?? 0);
  const situacao = falta > 0.005 ? `ainda faltam ${emReais(falta)} nesta cobrança` : "cobrança quitada";

  revalidatePath(`/dashboard/patients/${paciente.id}`);
  return {
    ok: true,
    recibo: {
      comando: "lançar pagamento",
      paciente: paciente.name,
      gravado: `${emReais(Number(novo.amount))} · ${situacao}`,
      quando: quandoDoRecibo(novo.date),
      id: novo.id,
    },
  };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
const emReais = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
