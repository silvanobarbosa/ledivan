"use server";

import { db } from "@/db";
import { auth } from "@/auth";
import { despesas, receitasPessoais, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const [despesasRows, receitasRows, cadastros] = await Promise.all([
    db.select({ nome: despesas.nome, valor: despesas.valor, vencimento: despesas.vencimento, pagamentoData: despesas.pagamentoData }).from(despesas).where(eq(despesas.userId, userId)),
    db.select({ nome: receitasPessoais.nome, valor: receitasPessoais.valor, recebimento: receitasPessoais.recebimento, recebido: receitasPessoais.recebido }).from(receitasPessoais).where(eq(receitasPessoais.userId, userId)),
    db.select({ id: patients.id, name: patients.name, phone: patients.phone, guardianPhone: patients.guardianPhone, paymentFormat: patients.paymentFormat, registrationNumber: patients.registrationNumber, agendaId: patients.agendaId, status: patients.patientStatus }).from(patients).where(eq(patients.userId, userId)),
  ]);

  const movs: Movimentacao[] = [];

  // Despesas → saída. Paga: data do pagamento; em aberto/atraso: vencimento (valor em branco).
  for (const d of despesasRows) {
    const v = Number(d.valor) || 0;
    const pago = !!d.pagamentoData;
    movs.push({ data: dia(pago ? d.pagamentoData : d.vencimento), descricao: d.nome, tipo: "saida", efetivado: pago, bruto: v, liquido: v, temLiquido: false });
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
