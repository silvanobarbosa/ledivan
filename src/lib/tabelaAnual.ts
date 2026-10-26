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

import { liquidoDoPagamento, type VigenciaTaxa } from "./taxaCartao";
import { recebidoPorForma, type FormaRecebida } from "./recebidoPorForma";

export type PagamentoAnual = { amount: string | number; date: string | Date; status: string; method?: string | null };

const isoDe = (d: string | Date): string => (d instanceof Date ? d.toISOString() : String(d));

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

/**
 * Uma linha da tabela anual. `valor` é o total LÍQUIDO do mês — o que entrou de verdade.
 * `formas` detalha por forma de pagamento (doc 53): cada uma com o bruto e, nos cartões, o líquido.
 */
export type LinhaAnual = { mes: string; valor: number; formas: FormaRecebida[]; estornado: number };

/** O dinheiro que VOLTOU para o paciente, no dia em que voltou (doc 60). */
export type EstornoAnual = { valor: string | number; data: string | Date };

/**
 * Os doze meses do ano com o total recebido em cada um, mais o total do ano.
 * Doc 50: o recebido entra pelo valor LÍQUIDO (desconta a taxa do cartão vigente na data).
 */
export function recebidosPorAno(
  pagamentos: PagamentoAnual[],
  ano: number,
  vigencias: VigenciaTaxa[] = [],
  estornos: EstornoAnual[] = [],
): { meses: LinhaAnual[]; total: number } {
  const soma = new Array(12).fill(0) as number[];
  /**
   * O estorno entra como SAÍDA do mês em que foi feito — não como desconto do mês do pagamento.
   *
   * A data importa: pagamento em outubro devolvido em novembro move dinheiro nos dois meses, e
   * juntar as duas pontas no mesmo mês apagaria os dois fatos de uma vez. É a mesma leitura que
   * Movimentações faz do mesmo par.
   */
  const devolvido = new Array(12).fill(0) as number[];
  for (const e of estornos) {
    const d = new Date(e.data);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== ano) continue;
    devolvido[d.getMonth()] += Number(e.valor) || 0;
  }
  // Doc 53: além do total do mês, a quebra por forma de pagamento. Reusa `recebidoPorForma`,
  // que é a mesma função do Menu Pagamentos — uma só regra decide o que mostra líquido.
  const porMes: PagamentoAnual[][] = Array.from({ length: 12 }, () => []);
  for (const p of pagamentos) {
    if (p.status !== "paid") continue;
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== ano) continue;
    soma[d.getMonth()] += liquidoDoPagamento(Number(p.amount) || 0, p.method, isoDe(p.date), vigencias);
    porMes[d.getMonth()].push(p);
  }
  const meses = soma.map((v, i) => ({
    mes: MESES[i],
    valor: Math.round(v * 100) / 100,
    formas: recebidoPorForma(
      porMes[i].map((p) => ({ valor: Number(p.amount) || 0, metodo: p.method, data: isoDe(p.date) })),
      vigencias,
    ).formas,
    estornado: Math.round(devolvido[i] * 100) / 100,
  }));
  // O total do ano é o LÍQUIDO: o que entrou menos o que voltou.
  const total = Math.round(meses.reduce((a, m) => a + m.valor - m.estornado, 0) * 100) / 100;
  return { meses, total };
}
