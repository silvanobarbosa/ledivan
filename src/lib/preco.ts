/**
 * O PREÇO QUE VALIA — por mês e por dia.
 *
 * Saiu de `fechamento.ts` para que o motor de cobranças (`cobrancas.ts`) e a Fechamento possam os
 * dois usá-lo sem um importar o outro em círculo. `fechamento.ts` reexporta, então quem já
 * importava de lá não muda.
 */

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

export type PrecoVigente = {
  valor: number;
  /** A partir de quando aquele valor passou a valer. */
  desde: Date | string;
};

/**
 * O preço que valia naquele mês.
 *
 * Pega a última faixa que começou até o FIM do mês fechado. Usar o preço de hoje para fechar um
 * mês antigo cobraria o reajuste retroativamente — e a conta pareceria certa na tela.
 */
export function precoNoMes(historico: PrecoVigente[], ano: number, mes: number): number {
  return precoNaData(historico, new Date(ano, mes + 1, 0, 23, 59, 59, 999));
}

/**
 * O preço que valia NAQUELE DIA.
 *
 * O acumulado precisa disto, não do preço do mês: cada cobrança vale o que valia quando aconteceu.
 * Sem isso, somar o passado inteiro com o preço de hoje faria a dívida de um ano atrás **crescer
 * sozinha a cada reajuste** — e ninguém perceberia olhando a tela.
 */
export function precoNaData(historico: PrecoVigente[], quando: Date, reserva = 0): number {
  const fimDoMes = quando;
  const validos = historico
    .map((h) => ({ valor: Number(h.valor), desde: emData(h.desde) }))
    .filter((h) => Number.isFinite(h.valor) && !Number.isNaN(h.desde.getTime()))
    .filter((h) => h.desde.getTime() <= fimDoMes.getTime())
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());

  if (validos.length > 0) return validos[validos.length - 1].valor;
  // Sem faixa que alcance a data: o valor do cadastro. Zero aqui apagaria a cobrança em silêncio.
  const r = Number(reserva);
  return Number.isFinite(r) && r > 0 ? r : 0;
}
