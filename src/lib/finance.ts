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
