/**
 * Status de uma despesa (doc 50), puro. A cor do valor no quadro vem daqui:
 * - paga: tem data de pagamento → verde.
 * - aberta: sem pagamento e dentro do prazo (vencimento hoje ou no futuro) → preto.
 * - atraso: sem pagamento e vencimento já passou → vermelho.
 * Compara só por dia (YYYY-MM-DD), sem passar por fuso.
 */
export type StatusDespesa = "paga" | "aberta" | "atraso";

const dia = (iso: string | null | undefined): string => String(iso ?? "").slice(0, 10);

export function statusDespesa(vencimento: string, pagamentoData: string | null | undefined, hojeISO: string): StatusDespesa {
  if (pagamentoData) return "paga";
  return dia(vencimento) < dia(hojeISO) ? "atraso" : "aberta";
}

/** Classe de cor do valor conforme o status (mesma paleta do Relatório financeiro). */
export function corDoStatus(status: StatusDespesa): string {
  return status === "paga" ? "text-[#047857]" : status === "atraso" ? "text-[#b91c1c]" : "text-foreground";
}
