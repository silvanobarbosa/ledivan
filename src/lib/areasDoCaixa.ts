/**
 * O QUE CADA ÁREA MOVIMENTOU (doc 64) — o total de cada quadro e a pizza abaixo do extrato.
 *
 * Sessões, supervisões, receitas pessoais e despesas pessoais saem TODAS do mesmo extrato que a
 * lista de Movimentações mostra, já recortado pelo filtro da tela. É de propósito: uma consulta
 * própria para o gráfico seria uma segunda contagem do mesmo dinheiro, e duas contagens que
 * divergem num detalhe é como a tela de uma paciente passou a somar o dobro ([[doc 62]]).
 *
 * Só o que foi EFETIVADO entra: previsto é promessa, não caixa. Dentro de cada área, a saída abate
 * a entrada — o estorno de uma sessão diminui o que as sessões renderam, em vez de virar uma fatia
 * de "saída" que ninguém saberia ler.
 *
 * Funções puras.
 */

import { type Movimentacao } from "./extratoBancario";

export type AreaDoCaixa = "sessao" | "supervisao" | "receita" | "despesa";

export const ROTULO_DA_AREA: Record<AreaDoCaixa, string> = {
  sessao: "Sessões",
  supervisao: "Supervisões",
  receita: "Receitas pessoais",
  despesa: "Despesas pessoais",
};

/** As cores da pizza: as mesmas do extrato (entrada verde/azul, saída vermelha). */
export const COR_DA_AREA: Record<AreaDoCaixa, string> = {
  sessao: "#2563eb",
  supervisao: "#7c3aed",
  receita: "#047857",
  despesa: "#b91c1c",
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Quanto cada área movimentou, pelo LÍQUIDO (é o que de fato entrou — doc 50).
 *
 * Devolve sempre as quatro áreas, inclusive zeradas: a pizza some, mas o total de cada quadro
 * precisa dizer "R$ 0,00" em vez de desaparecer.
 */
export function totaisPorArea(movs: Movimentacao[]): Record<AreaDoCaixa, number> {
  const out: Record<AreaDoCaixa, number> = { sessao: 0, supervisao: 0, receita: 0, despesa: 0 };
  for (const m of movs) {
    if (!m.efetivado || !m.categoria) continue;
    const sinal = m.tipo === "entrada" ? 1 : -1;
    // Despesa é saída por natureza: ela soma pelo que saiu, senão a fatia nasceria negativa.
    const valor = m.categoria === "despesa" ? m.liquido : sinal * m.liquido;
    out[m.categoria] = r2(out[m.categoria] + valor);
  }
  return out;
}

/** As fatias da pizza, só com o que tem valor positivo — fatia de zero ou negativa não se desenha. */
export function fatiasDaPizza(movs: Movimentacao[]): { area: AreaDoCaixa; rotulo: string; valor: number; cor: string }[] {
  const totais = totaisPorArea(movs);
  return (Object.keys(ROTULO_DA_AREA) as AreaDoCaixa[])
    .map((a) => ({ area: a, rotulo: ROTULO_DA_AREA[a], valor: totais[a], cor: COR_DA_AREA[a] }))
    .filter((f) => f.valor > 0.005);
}

/** O total do extrato: o que entrou, o que saiu e o saldo — só o efetivado. */
export function totaisDoExtrato(movs: Movimentacao[]): { entradas: number; saidas: number; saldo: number } {
  let entradas = 0, saidas = 0;
  for (const m of movs) {
    if (!m.efetivado) continue;
    if (m.tipo === "entrada") entradas += m.liquido;
    else saidas += m.liquido;
  }
  return { entradas: r2(entradas), saidas: r2(saidas), saldo: r2(entradas - saidas) };
}
