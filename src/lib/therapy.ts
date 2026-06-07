// Helpers do domínio Terapia (Ledivan): formatação e labels.

// Sala de vídeo (Jitsi) derivada do id da sessão — sem config/OAuth.
export function meetingUrl(sessionId: string): string {
  return `https://meet.jit.si/LEDivan-${sessionId}`;
}

// Cor unificada das sessões (agenda, cards, listas):
// reserva=amarelo, realizada=verde, não-realizada(cancelada/falta/realocada)=vermelho, agendada futura=roxo.
export function sessionColorClasses(status: string, pending?: boolean, recurring?: boolean): string {
  if (recurring && status !== "realizada" && status !== "cancelada" && status !== "nao_realizada") return "bg-[#dbeafe] text-[#1e40af] border-[#3b82f6]";
  if (pending) return "bg-[#fef3c7] text-[#92400e] border-[#f59e0b]";
  if (status === "realizada") return "bg-[#dcfce7] text-[#166534] border-[#22c55e]";
  if (status === "cancelada" || status === "nao_realizada" || status === "realocada") return "bg-[#fee2e2] text-[#b91c1c] border-[#ef4444]";
  return "bg-[#ede9fe] text-[#5b21b6] border-[#8b5cf6]";
}
export function sessionLabel(status: string, pending?: boolean, recurring?: boolean): string {
  if (recurring && status !== "realizada") return "Recorrente";
  if (pending) return "Reserva";
  return SESSION_STATUS_LABELS[status] ?? status;
}

export const REMINDER_CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  telegram: "Telegram",
};

// Risco de falta: heurística sobre o histórico de sessões passadas do paciente.
export type RiskLevel = "baixo" | "medio" | "alto";

export function riskFromSessions(sessions: { status: string; date: string | Date }[]): {
  level: RiskLevel;
  rate: number;
  faltas: number;
  total: number;
} {
  const now = Date.now();
  const past = sessions.filter((s) => new Date(s.date).getTime() < now);
  const faltas = past.filter((s) => s.status === "nao_realizada" || s.status === "cancelada").length;
  const realizadas = past.filter((s) => s.status === "realizada").length;
  const total = faltas + realizadas;
  const rate = total > 0 ? faltas / total : 0;

  let level: RiskLevel = "baixo";
  if (total < 3 && faltas < 2) level = "baixo";
  else if (rate >= 0.4 || faltas >= 4) level = "alto";
  else if (rate >= 0.2 || faltas >= 2) level = "medio";

  return { level, rate, faltas, total };
}

export const RISK_LABELS: Record<RiskLevel, string> = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" };

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case "alto": return "bg-[#fee2e2] text-[#b91c1c]";
    case "medio": return "bg-[#fffbeb] text-[#b45309]";
    default: return "bg-[#ecfdf5] text-[#047857]";
  }
}

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
