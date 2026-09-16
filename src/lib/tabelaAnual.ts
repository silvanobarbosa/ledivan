/**
 * A tabela anual de valores RECEBIDOS por mês (dono, 16/09/2026) — a mesma tabela do consolidado,
 * mas dentro do paciente e filtrada por ANO em vez de por paciente.
 *
 * Só pagamento com status "paid" conta como recebido. A data é hora de parede (texto sem fuso), lida
 * como local. Função pura.
 */

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type PagamentoAnual = { amount: string | number; date: string | Date; status: string };

/** Os anos que têm algum pagamento recebido, do mais recente para o mais antigo. */
export function anosComPagamento(pagamentos: PagamentoAnual[]): number[] {
  const anos = new Set<number>();
  for (const p of pagamentos) {
    if (p.status !== "paid") continue;
    const d = new Date(p.date);
    if (!Number.isNaN(d.getTime())) anos.add(d.getFullYear());
  }
  return [...anos].sort((a, b) => b - a);
}

export type LinhaAnual = { mes: string; valor: number };

/** Os doze meses do ano com o total recebido em cada um, mais o total do ano. */
export function recebidosPorAno(pagamentos: PagamentoAnual[], ano: number): { meses: LinhaAnual[]; total: number } {
  const soma = new Array(12).fill(0) as number[];
  for (const p of pagamentos) {
    if (p.status !== "paid") continue;
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== ano) continue;
    soma[d.getMonth()] += Number(p.amount) || 0;
  }
  const meses = soma.map((v, i) => ({ mes: MESES[i], valor: Math.round(v * 100) / 100 }));
  const total = Math.round(meses.reduce((a, m) => a + m.valor, 0) * 100) / 100;
  return { meses, total };
}
