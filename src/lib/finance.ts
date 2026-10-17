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

/** Normaliza uma taxa de cartão vinda do form: número entre 0 e 100, com 2 casas; fora disso vira 0. */
export function normalizarTaxa(bruto: unknown): number {
  const n = typeof bruto === "number" ? bruto : parseFloat(String(bruto ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(Math.min(100, n) * 100) / 100;
}
