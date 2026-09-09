// Utilitário dos tooltips de gráfico (recharts).
//
// Os formatters estavam tipados como `any`, e isso escondia duas coisas que o compilador
// aponta assim que o `any` sai: o valor pode chegar como ARRAY (série com múltiplos valores)
// e pode chegar UNDEFINED. Nos dois casos `Number(v)` vira NaN e o usuário via "R$ NaN".

// O array vem READONLY do recharts — usar `Array<...>` aqui faz o compilador recusar.
export type ValorTooltip = number | string | readonly (number | string)[] | undefined;

/** Número utilizável a partir do que o recharts entrega. Array usa o primeiro item; vazio vira 0. */
export function numeroDoTooltip(v: ValorTooltip): number {
  const bruto = Array.isArray(v) ? v[0] : v;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : 0;
}
