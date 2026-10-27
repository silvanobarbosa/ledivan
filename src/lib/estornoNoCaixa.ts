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
 *
 * Doc 62: as duas carregam a SESSÃO a que se referem, na descrição ("Pagamento · Fulano · Sessão
 * 28/10/26") e no `par`, que é o que põe o estorno logo abaixo do pagamento que ele desfez.
 */
export type PagamentoDesfeito = { valor: number | string | null; data: string; paciente: string; sessaoId?: string | null; sessaoEm?: string | null; categoria?: "sessao" | "supervisao" };
export type EstornoNoCaixa = PagamentoDesfeito;

/** `2026-10-28…` → `28/10/26`. Vazio quando não há data de sessão. */
export function sessaoEmBR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "";
}

/** "Pagamento · Fulano · Sessão 28/10/26" — a sessão só entra quando se sabe qual é. */
export function descricaoDoMovimento(rotulo: string, paciente: string, sessaoEm?: string | null): string {
  const d = sessaoEmBR(sessaoEm);
  return [rotulo, paciente, d ? `Sessão ${d}` : null].filter(Boolean).join(" · ");
}

export function movimentosDoEstorno(pagamentos: PagamentoDesfeito[], estornos: EstornoNoCaixa[]): Movimentacao[] {
  const movs: Movimentacao[] = [];
  const linha = (x: PagamentoDesfeito, tipo: "entrada" | "saida"): void => {
    const v = Number(x.valor) || 0;
    if (v <= 0) return;
    movs.push({
      data: x.data,
      descricao: descricaoDoMovimento(tipo === "entrada" ? "Pagamento" : "Estorno", x.paciente, x.sessaoEm),
      tipo, efetivado: true, bruto: v, liquido: v, temLiquido: false,
      par: x.sessaoId ?? null,
      categoria: x.categoria ?? "sessao",
    });
  };
  for (const p of pagamentos) linha(p, "entrada");
  for (const e of estornos) linha(e, "saida");
  return movs;
}
