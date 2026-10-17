// Formas de pagamento/recebimento de uma transação.
export const PAYMENT_FORMS: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "deposito", label: "Depósito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export const PAYMENT_FORM_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_FORMS.map((f) => [f.value, f.label]),
);

/**
 * Taxas da maquininha (doc 47): percentuais que a operadora desconta do que foi recebido no
 * débito e no crédito. Ficam nas Configurações; servem para mostrar o valor LÍQUIDO (o que de
 * fato cai na conta). Não alteram o valor lançado — o bruto é o fato, o líquido é um apoio.
 */
export type CardFees = { debito?: number; credito?: number };

/** Normaliza uma taxa vinda do form: número entre 0 e 100, com 2 casas; fora disso vira 0. */
export function normalizarTaxa(bruto: unknown): number {
  const n = typeof bruto === "number" ? bruto : parseFloat(String(bruto ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(100, n) * 100) / 100;
}

/**
 * Valor líquido de uma receita após a taxa da maquininha, conforme a forma de recebimento.
 * Só débito e crédito têm taxa; qualquer outra forma (ou taxa ausente/zero) devolve o próprio valor.
 */
export function liquidoComTaxa(valor: number, method: string | null | undefined, fees: CardFees | undefined): number {
  if (!Number.isFinite(valor) || valor <= 0 || !fees) return valor;
  const taxa = method === "debito" ? fees.debito : method === "credito" ? fees.credito : undefined;
  if (!taxa || taxa <= 0) return valor;
  return Math.round(valor * (1 - taxa / 100) * 100) / 100;
}
