"use server";

import { db } from "@/db";
import { auth } from "@/auth";
import { despesas, receitasPessoais, patients, transactions, therapySessions } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { geralDoPaciente, type LinhaNaTela } from "@/lib/geralDoPaciente";
import { resolverCobrancas } from "@/lib/resolverCobrancas";
import { getVigenciasTaxa } from "@/lib/cardFees";
import { ordenarExtrato, type Movimentacao } from "@/lib/extratoBancario";

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
  const [despesasRows, receitasRows, cadastros, despesasDoLivro, estornos] = await Promise.all([
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
    db.select({ valor: therapySessions.estornoValor, data: therapySessions.estornoEm, paciente: patients.name })
      .from(therapySessions)
      .innerJoin(patients, eq(patients.id, therapySessions.patientId))
      .where(and(eq(therapySessions.userId, userId), isNotNull(therapySessions.estornoEm))),
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

  // Estorno → saída, no dia em que o dinheiro voltou. A entrada original continua no extrato,
  // então as duas pontas aparecem e o saldo fecha em zero.
  for (const e of estornos) {
    const v = Number(e.valor) || 0;
    if (v <= 0) continue;
    movs.push({ data: dia(e.data), descricao: `Estorno · ${e.paciente}`, tipo: "saida", efetivado: true, bruto: v, liquido: v, temLiquido: false });
  }

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
      if (rec && rec.totalBruto > 0.005) {
        movs.push({ data: dia(c.pagoEm ?? c.vencimento), descricao: c.nome, tipo: "entrada", efetivado: true, bruto: rec.totalBruto, liquido: rec.totalLiquido, temLiquido: Math.abs(rec.totalBruto - rec.totalLiquido) > 0.005 });
      }
      if (c.situacao !== "pago" && c.falta > 0.005) {
        movs.push({ data: dia(c.vencimento), descricao: c.nome, tipo: "entrada", efetivado: false, bruto: c.falta, liquido: c.falta, temLiquido: false });
      }
    }
  }));

  return { ok: true, movs: ordenarExtrato(movs.filter((m) => m.data)) };
}
