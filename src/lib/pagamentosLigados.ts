import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { patientCredits, sessionPayments, therapySessions, transactions } from "@/db/schema";

/**
 * APAGAR UM PAGAMENTO LEVA JUNTO TUDO O QUE ESTÁ PRESO A ELE (doc 61).
 *
 * "Ao excluir um pagamento ou um agendamento todo pagamento ligado a ele deve ser excluído."
 *
 * O caso que motivou é feio e já está em produção: excluído o AGENDAMENTO, o pagamento ficava. A
 * coluna `session_id` é `ON DELETE SET NULL`, então ele perdia a sessão mas mantinha a chave
 * `extra:<id>` de uma sessão que não existe mais — e a guia Geral, não achando essa cobrança,
 * redistribui o dinheiro órfão por vencimento e vai ABATER a próxima cobrança do paciente. A
 * terapeuta vê uma sessão se pagar sozinha com o dinheiro de outra que ela apagou.
 *
 * Este módulo é a limpeza completa, numa função só, porque ela é a mesma em três portas (excluir
 * agendamento, excluir sessão, remover pagamento) e porque esquecer um dos rastros é justamente o
 * defeito que se está consertando:
 *
 * - a TRANSAÇÃO do caixa, que é o mesmo fato contado noutra tela;
 * - o CRÉDITO que o pagamento gerou e que ninguém usou ainda — ele some, porque a sobra que o
 *   criou deixou de existir;
 * - o CRÉDITO que o pagamento consumiu — esse VOLTA ao saldo, marcado com `naoAuto` para não
 *   correr de volta sozinho para a cobrança de onde acabou de sair (doc 59).
 */
export async function apagarPagamentosLigados(userId: string, pagamentoIds: string[]): Promise<number> {
  const ids = [...new Set(pagamentoIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return 0;

  const alvos = await db.select({ id: sessionPayments.id, tx: sessionPayments.linkedTransactionId })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.userId, userId), inArray(sessionPayments.id, ids)));
  if (!alvos.length) return 0;

  const txs = alvos.map((p) => p.tx).filter((t): t is string => !!t);
  if (txs.length) {
    await db.delete(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.id, txs)));
  }

  const alvoIds = alvos.map((p) => p.id);
  await db.delete(patientCredits).where(and(
    eq(patientCredits.userId, userId),
    inArray(patientCredits.origemPagamentoId, alvoIds),
    isNull(patientCredits.consumidoEm),
  ));
  await db.update(patientCredits).set({ consumidoEm: null, consumidoPagamentoId: null, naoAuto: true })
    .where(and(eq(patientCredits.userId, userId), inArray(patientCredits.consumidoPagamentoId, alvoIds)));

  await db.delete(sessionPayments).where(and(eq(sessionPayments.userId, userId), inArray(sessionPayments.id, alvoIds)));
  return alvoIds.length;
}

/**
 * OS PAGAMENTOS PRESOS A ESTAS SESSÕES.
 *
 * Três caminhos chegam ao mesmo dinheiro, e procurar por um só deixa rastro para trás:
 * `session_id` (o vínculo direto), e as duas chaves de cobrança possíveis — `extra:<id>` para a
 * sessão avulsa ou a falta cobrada, `sessao:<id>` para o paciente do formato Avulso (doc 58).
 *
 * O que NÃO entra é o pagamento TRANSFERIDO desta sessão para outra: ele já pertence à sessão de
 * destino e paga uma cobrança viva. Apagá-lo junto com o agendamento antigo tiraria do paciente um
 * dinheiro que ele pagou e que está quitando outra coisa — a marca de origem é só um caminho de
 * volta, não um vínculo de posse.
 */
export async function pagamentosDasSessoes(userId: string, sessionIds: string[]): Promise<string[]> {
  const ids = [...new Set(sessionIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return [];
  const chaves = ids.flatMap((id) => [`extra:${id}`, `sessao:${id}`]);
  const rows = await db.select({ id: sessionPayments.id }).from(sessionPayments)
    .where(and(
      eq(sessionPayments.userId, userId),
      or(inArray(sessionPayments.sessionId, ids), inArray(sessionPayments.cobrancaChave, chaves)),
    ));
  return rows.map((r) => r.id);
}

/**
 * Apaga as sessões E o dinheiro que pendurava nelas. Devolve quantos pagamentos saíram.
 *
 * A ordem é de propósito: os pagamentos primeiro, enquanto as sessões ainda existem. Depois do
 * DELETE das sessões o `session_id` já foi a `null` pelo próprio banco, e metade do caminho de
 * volta teria sumido.
 */
export async function apagarSessoesComPagamentos(userId: string, sessionIds: string[]): Promise<number> {
  const ids = [...new Set(sessionIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return 0;
  const apagados = await apagarPagamentosLigados(userId, await pagamentosDasSessoes(userId, ids));
  // O pagamento que VEIO de uma destas sessões continua valendo noutra: só o caminho de volta some.
  await db.update(sessionPayments).set({ origemSessaoId: null })
    .where(and(eq(sessionPayments.userId, userId), inArray(sessionPayments.origemSessaoId, ids)));
  await db.delete(therapySessions).where(and(eq(therapySessions.userId, userId), inArray(therapySessions.id, ids)));
  return apagados;
}
