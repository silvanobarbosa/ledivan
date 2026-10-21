/**
 * Crédito e suas parcelas (doc 53).
 *
 * No banco cada parcelamento é uma FORMA de pagamento própria (`credito`, `credito_2x` …
 * `credito_5x`), porque cada uma tem o seu percentual de taxa. Na tela, porém, o terapeuta pensa
 * em duas etapas: primeiro "foi no crédito", depois "em quantas vezes".
 *
 * Este módulo é a tradução entre as duas visões. Fica separado da tela porque é ele que decide
 * qual string vai para o banco — e errar a string significa aplicar a taxa errada, em silêncio.
 */

/** Em quantas vezes o crédito pode ser parcelado. 1 = à vista. */
export const PARCELAS_CREDITO = [1, 2, 3, 4, 5] as const;
export type ParcelaCredito = (typeof PARCELAS_CREDITO)[number];

/** A forma que vai para o banco. À vista é `credito` (sem sufixo) — assim era antes do 2x existir. */
export function metodoDoCredito(parcelas: number): string {
  const n = PARCELAS_CREDITO.includes(parcelas as ParcelaCredito) ? parcelas : 1;
  return n === 1 ? "credito" : `credito_${n}x`;
}

/** Quantas parcelas uma forma representa. `null` quando a forma não é crédito. */
export function parcelasDoMetodo(metodo: string | null | undefined): number | null {
  const m = String(metodo ?? "");
  if (m === "credito") return 1;
  const casou = /^credito_(\d+)x$/.exec(m);
  if (!casou) return null;
  const n = Number(casou[1]);
  return PARCELAS_CREDITO.includes(n as ParcelaCredito) ? n : null;
}

/** É crédito, em qualquer número de parcelas? */
export function ehCredito(metodo: string | null | undefined): boolean {
  return parcelasDoMetodo(metodo) !== null;
}

/** "à vista", "2x"… para o rótulo do seletor. */
export function rotuloDaParcela(parcelas: number): string {
  return parcelas === 1 ? "à vista" : `${parcelas}x`;
}
