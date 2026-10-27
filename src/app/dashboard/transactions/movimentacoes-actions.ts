"use server";

import { db } from "@/db";
import { auth } from "@/auth";
import { despesas, receitasPessoais, patients, sessionPayments, transactions, therapySessions } from "@/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { geralDoPaciente, type LinhaNaTela } from "@/lib/geralDoPaciente";
import { resolverCobrancas } from "@/lib/resolverCobrancas";
import { getVigenciasTaxa } from "@/lib/cardFees";
import { ordenarExtrato, type Movimentacao } from "@/lib/extratoBancario";
import { descricaoDoMovimento, movimentosDoEstorno } from "@/lib/estornoNoCaixa";

const dia = (iso: string | Date | null | undefined): string => {
  if (iso == null) return "";
  const s = iso instanceof Date ? iso.toISOString() : String(iso);
  return s.slice(0, 10);
};

/**
 * Monta o extrato de Movimentações (doc 50): despesas + receitas pessoais + pagamentos de pacientes/
 * supervisionados (realizados e previstos), em ordem cronológica. Pagamento no cartão leva bruto+líquido.
 */
export async function montarMovimentacoes(): Promise<{ ok: boolean; movs?: Movimentacao[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const vigencias = await getVigenciasTaxa(userId);
  const [despesasRows, receitasRows, cadastros, despesasDoLivro, estornos, pagamentosDesfeitos] = await Promise.all([
    db.select({ nome: despesas.nome, valor: despesas.valor, vencimento: despesas.vencimento, pagamentoData: despesas.pagamentoData }).from(despesas).where(eq(despesas.userId, userId)),
    db.select({ nome: receitasPessoais.nome, valor: receitasPessoais.valor, recebimento: receitasPessoais.recebimento, recebido: receitasPessoais.recebido }).from(receitasPessoais).where(eq(receitasPessoais.userId, userId)),
    db.select({ id: patients.id, name: patients.name, phone: patients.phone, guardianPhone: patients.guardianPhone, paymentFormat: patients.paymentFormat, registrationNumber: patients.registrationNumber, agendaId: patients.agendaId, status: patients.patientStatus }).from(patients).where(eq(patients.userId, userId)),
    /**
     * As despesas lançadas no LIVRO (`transactions`), que é onde elas moravam antes deste módulo.
     *
     * O extrato lia só a tabela nova, e o resultado era a tela se contradizendo: "Nenhuma despesa
     * cadastrada" logo acima de uma lista com anos de despesas. As duas estavam certas — olhavam
     * lugares diferentes.
     *
     * Elas entram aqui para LER, não para mudar de lugar. Mover as linhas custaria a categoria, a
     * forma de pagamento e a conta, que a tabela nova não guarda, e deixaria os Relatórios somando
     * zero — ver a nota na PR.
     */
    db.select({ valor: transactions.amount, data: transactions.date, descricao: transactions.description })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"))),
    /**
     * Os ESTORNOS — dinheiro que voltou para o paciente (doc 57).
     *
     * Entram como SAÍDA, e isso só fecha porque o pagamento estornado continua no extrato como
     * entrada: as duas pontas aparecem, e o saldo volta a zero. Se o pagamento fosse apagado, esta
     * saída sozinha tiraria do mês um dinheiro que já não estava lá — a duplicidade que o
     * documento manda evitar.
     */
    db.select({ valor: therapySessions.estornoValor, data: therapySessions.estornoEm, paciente: patients.name, sessaoId: therapySessions.id, sessaoEm: therapySessions.date })
      .from(therapySessions)
      .innerJoin(patients, eq(patients.id, therapySessions.patientId))
      .where(and(eq(therapySessions.userId, userId), isNotNull(therapySessions.estornoEm))),
    /**
     * OS PAGAMENTOS QUE DEIXARAM DE QUITAR — e que por isso sumiriam do caixa.
     *
     * O dinheiro deste mundo entra uma vez só, e a entrada do extrato vinha do CASAMENTO do
     * pagamento com a cobrança. Quando a cobrança deixa de existir (a sessão virou GRAT), o
     * pagamento para de casar com qualquer coisa e a entrada evapora — e aí o estorno acima ficaria
     * tirando do mês um dinheiro que nunca apareceu nele. É a duplicidade ao contrário, e dá o
     * mesmo resultado errado.
     *
     * Então a entrada entra por aqui, no dia em que o paciente pagou de verdade. As duas pontas
     * aparecem, o saldo fecha em zero, e o histórico continua contando o que aconteceu.
     *
     * Vale também quando o valor virou CRÉDITO em vez de estorno: a entrada é a mesma, e não há
     * saída para parear. O crédito consumido depois entra como `kind="credito"`, que o cálculo de
     * recebido ignora de propósito — não é dinheiro novo.
     */
    db.select({ valor: sessionPayments.amount, data: sessionPayments.date, paciente: patients.name, sessaoId: therapySessions.id, sessaoEm: therapySessions.date })
      .from(sessionPayments)
      .innerJoin(patients, eq(patients.id, sessionPayments.patientId))
      .leftJoin(therapySessions, eq(therapySessions.id, sessionPayments.sessionId))
      .where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid"), isNotNull(sessionPayments.estornadoEm), isNull(sessionPayments.kind))),
  ]);

  const movs: Movimentacao[] = [];

  // Despesas → saída. Paga: data do pagamento; em aberto/atraso: vencimento (valor em branco).
  for (const d of despesasRows) {
    const v = Number(d.valor) || 0;
    const pago = !!d.pagamentoData;
    movs.push({ data: dia(pago ? d.pagamentoData : d.vencimento), descricao: d.nome, tipo: "saida", efetivado: pago, bruto: v, liquido: v, temLiquido: false });
  }

  // Despesa do livro → saída, sempre efetivada: ela é o registro de um gasto que já aconteceu.
  for (const t of despesasDoLivro) {
    const v = Number(t.valor) || 0;
    movs.push({ data: dia(t.data), descricao: t.descricao || "Despesa", tipo: "saida", efetivado: true, bruto: v, liquido: v, temLiquido: false });
  }

  // As duas pontas do dinheiro que voltou: a entrada no dia do pagamento, a saída no dia do
  // estorno. A regra, e o porquê de ela existir, moram em `estornoNoCaixa`.
  movs.push(...movimentosDoEstorno(
    pagamentosDesfeitos.map((p) => ({ valor: p.valor, data: dia(p.data), paciente: p.paciente, sessaoId: p.sessaoId, sessaoEm: dia(p.sessaoEm) })),
    estornos.map((e) => ({ valor: e.valor, data: dia(e.data), paciente: e.paciente, sessaoId: e.sessaoId, sessaoEm: dia(e.sessaoEm) })),
  ));

  // Receitas pessoais → entrada. Recebida: data de recebimento (verde); prevista: mesma data, sem valor.
  for (const r of receitasRows) {
    const v = Number(r.valor) || 0;
    movs.push({ data: dia(r.recebimento), descricao: r.nome, tipo: "entrada", efetivado: r.recebido, bruto: v, liquido: v, temLiquido: false });
  }

  // Pacientes/supervisionados → entrada. Realizado (recebido) pelo líquido (cartão mostra bruto+líquido);
  // pendente pela data de vencimento, sem valor.
  const lista = cadastros.filter((p) => p.status !== "prospect");
  await Promise.all(lista.map(async (p) => {
    const geral = await geralDoPaciente(userId, p.id);
    if (!geral) return;
    for (const c of resolverCobrancas(geral.linhas as LinhaNaTela[], p, vigencias)) {
      const rec = c.recebido;
      // Doc 62: a descrição diz O QUE é, DE QUEM e DE QUAL SESSÃO — "Marcela Damaceno" sozinho,
      // repetido quatro vezes no mesmo dia, não deixava conferir linha por linha.
      const sessaoEm = c.primeiraSessao ?? c.vencimento;
      if (rec && rec.totalBruto > 0.005) {
        movs.push({ data: dia(c.pagoEm ?? c.vencimento), descricao: descricaoDoMovimento("Pagamento", c.nome, dia(sessaoEm)), tipo: "entrada", efetivado: true, bruto: rec.totalBruto, liquido: rec.totalLiquido, temLiquido: Math.abs(rec.totalBruto - rec.totalLiquido) > 0.005 });
      }
      if (c.situacao !== "pago" && c.falta > 0.005) {
        movs.push({ data: dia(c.vencimento), descricao: descricaoDoMovimento("Previsto", c.nome, dia(sessaoEm)), tipo: "entrada", efetivado: false, bruto: c.falta, liquido: c.falta, temLiquido: false });
      }
    }
  }));

  return { ok: true, movs: ordenarExtrato(movs.filter((m) => m.data)) };
}
