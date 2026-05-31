// Helpers do domínio Terapia (Ledivan): formatação e labels.

export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const SESSION_STATUS_LABELS: Record<string, string> = {
  realizada: "Realizada",
  nao_realizada: "Não realizada",
  cancelada: "Cancelada",
  realocada: "Remarcada",
  agendada: "Agendada",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  transfer: "Transferência",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

// classes de cor (Tailwind) por status — paleta Warm Glass
export function sessionStatusColor(status: string): string {
  switch (status) {
    case "realizada": return "bg-[#ecfdf5] text-[#047857]";
    case "agendada": return "bg-[#f3e8ff] text-primary";
    case "realocada": return "bg-[#fffbeb] text-[#b45309]";
    case "cancelada":
    case "nao_realizada": return "bg-[#fee2e2] text-[#b91c1c]";
    default: return "bg-[#f4f4f5] text-[#6b7280]";
  }
}

export function paymentStatusColor(status: string): string {
  switch (status) {
    case "paid": return "bg-[#ecfdf5] text-[#047857]";
    case "pending": return "bg-[#fffbeb] text-[#b45309]";
    case "overdue": return "bg-[#fee2e2] text-[#b91c1c]";
    default: return "bg-[#f4f4f5] text-[#6b7280]";
  }
}

export function patientStatusColor(status: string): string {
  switch (status) {
    case "ativo": return "bg-[#ecfdf5] text-[#047857]";
    case "prospect": return "bg-[#f3e8ff] text-primary";
    case "pausado": return "bg-[#fffbeb] text-[#b45309]";
    case "inativo": return "bg-[#f4f4f5] text-[#6b7280]";
    default: return "bg-[#f4f4f5] text-[#6b7280]";
  }
}
