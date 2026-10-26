import type { Movimentacao } from "@/lib/extratoBancario";

/**
 * AS DUAS PONTAS DO DINHEIRO QUE VOLTOU (doc 57/58).
 *
 * O extrato monta as entradas a partir do CASAMENTO do pagamento com a cobrança. Quando a cobrança
 * deixa de existir — a sessão AVUL virou GRAT —, o pagamento para de casar com qualquer coisa e a
 * entrada evapora. Se só o estorno aparecesse, o mês perderia um dinheiro que nunca entrou nele:
 * é a duplicidade ao contrário, e dá o mesmo resultado errado que o documento manda evitar.
 *
 * Então as duas pontas são escritas aqui, explicitamente:
 *
 * - a ENTRADA no dia em que o paciente pagou, que é quando o dinheiro entrou de verdade;
 * - a SAÍDA no dia do estorno, que é quando ele voltou.
 *
 * Quando o valor virou CRÉDITO em vez de estorno, só existe a entrada — o dinheiro não voltou para
 * ninguém, ficou com o paciente. O crédito consumido depois entra como `kind="credito"`, que o
 * cálculo de recebido ignora de propósito: não é dinheiro novo.
 */
export type PagamentoDesfeito = { valor: number | string | null; data: string; paciente: string };
export type EstornoNoCaixa = { valor: number | string | null; data: string; paciente: string };

export function movimentosDoEstorno(pagamentos: PagamentoDesfeito[], estornos: EstornoNoCaixa[]): Movimentacao[] {
  const movs: Movimentacao[] = [];
  const linha = (x: { valor: number | string | null; data: string; paciente: string }, tipo: "entrada" | "saida"): void => {
    const v = Number(x.valor) || 0;
    if (v <= 0) return;
    const descricao = tipo === "entrada" ? `Pagamento · ${x.paciente}` : `Estorno · ${x.paciente}`;
    movs.push({ data: x.data, descricao, tipo, efetivado: true, bruto: v, liquido: v, temLiquido: false });
  };
  for (const p of pagamentos) linha(p, "entrada");
  for (const e of estornos) linha(e, "saida");
  return movs;
}
