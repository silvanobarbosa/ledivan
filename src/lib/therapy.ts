// Helpers do domínio Terapia (Ledivan): formatação e labels.

// Sala de vídeo (Jitsi) derivada do id da sessão — sem config/OAuth.
export function meetingUrl(sessionId: string): string {
  return `https://meet.jit.si/LEDivan-${sessionId}`;
}

/**
 * A COR DA CÉLULA DIZ O QUE ACONTECEU NA SESSÃO.
 *
 * Antes ela dizia outra coisa: que TIPO de compromisso era aquele — azul para recorrente, âmbar
 * para reserva, roxo para agendada. Eram duas informações disputando o mesmo pixel, e o lote das
 * beta testers escolheu a segunda: o que interessa olhando a semana é quem veio, quem faltou e
 * quem desmarcou.
 *
 * Sem status a célula fica TRANSPARENTE. Um agendamento que ainda não aconteceu não tem o que
 * relatar, e pintá-lo gastava cor à toa — quando tudo é colorido, cor nenhuma chama atenção.
 *
 * O que era dito pela cor e não podia sumir mudou de lugar: a reserva à espera de confirmação
 * continua marcada pela ampulheta na célula, e a repetição ganha (M) e (Q) ao lado do paciente.
 */
export function sessionColorClasses(status: string, pending?: boolean, recurring?: boolean, vencida?: boolean): string {
  void recurring; // a recorrência é dita por (M)/(Q), não mais pela cor
  void pending; // a reserva é dita pela ampulheta, não mais pela cor
  // Reserva que já passou e ninguém disse o que aconteceu: a única exceção ao "sem status =
  // transparente". Aqui a cor VOLTA a ter função — laranja de aviso, para a terapeuta não perder no
  // meio da semana uma sessão que precisa de decisão. Distinto do amarelo (Presente) e dos vermelhos.
  if (vencida) return "bg-[#ffedd5] text-[#9a3412] border-[#fb923c]";
  return STATUS_CORES[status] ?? "bg-transparent text-foreground/80 border-border";
}

/**
 * Reserva vencida = agendamento (`agendada`) cujo DIA já passou e a terapeuta ainda não disse o que
 * aconteceu (Presente/Faltou/Desmarcou/...). O dia é comparado inteiro: uma reserva de hoje mais cedo
 * ainda não venceu — o dia não acabou. Só `agendada` conta; qualquer status já é um desfecho.
 */
export function reservaVencida(status: string, date: Date | string, hoje: Date): boolean {
  if (status !== "agendada") return false;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hj = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return dia < hj;
}

/**
 * A legenda, na ordem em que elas a escreveram. Cada estado tem cor E palavra: quem enxerga pouca
 * cor, quem está num monitor ruim e quem imprime a tela precisam ler a mesma coisa que todo mundo.
 */
const STATUS_CORES: Record<string, string> = {
  realizada: "bg-[#fef9c3] text-[#854d0e] border-[#eab308]",       // Presente — amarelo
  nao_realizada: "bg-[#fecaca] text-[#991b1b] border-[#ef4444]",   // Faltou — vermelho
  cancelada: "bg-[#ede9fe] text-[#6d28d9] border-[#c4b5fd]",       // Desmarcou — violeta (longe do vermelho do Faltou)
  realocada: "bg-[#ede9fe] text-[#6d28d9] border-[#c4b5fd]",       // legado, se comporta como Desmarcou
  prof_desmarcou: "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]",  // Prof. desm. — cinza claro
  atestado: "bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]",        // Atestado — azul claro
};

export function sessionLabel(status: string, pending?: boolean, recurring?: boolean): string {
  void recurring;
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
  // Só FALTOU conta como falta. Antes "cancelada" entrava aqui junto, e com os status novos isso
  // ficaria absurdo: quem apresentou atestado, ou teve a sessão desmarcada pelo próprio
  // profissional, viraria paciente de risco de evasão — o contrário do que este número serve para
  // dizer. Ausência avisada não é ausência não avisada.
  const faltas = past.filter((s) => s.status === "nao_realizada").length;
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
  realizada: "Presente",
  nao_realizada: "Faltou",
  cancelada: "Desmarcou",
  // Legado: nasceu antes do lote e não tem lugar na legenda nova. Fica no banco pelo histórico e
  // aparece como Desmarcou, que é como já se comporta — fora da contagem e fora da cobrança.
  realocada: "Desmarcou",
  agendada: "Agendada",
  prof_desmarcou: "Prof. desm.",
  atestado: "Atestado",
};

/**
 * Os status que PAUSAM a sequência do pacote: o paciente não perde a sessão, e a próxima assume a
 * posição que ficou parada. Também são os que não geram cobrança.
 */
export const STATUS_QUE_PAUSAM = new Set(["cancelada", "realocada", "prof_desmarcou", "atestado"]);

/** Os que FAZEM A SEQUÊNCIA AVANÇAR: a posição foi ocupada, o paciente tendo vindo ou não. */
export const STATUS_QUE_AVANCAM = new Set(["agendada", "realizada", "nao_realizada"]);

/**
 * O que a pessoa pode ESCOLHER. Não é a mesma lista do que o sistema sabe EXIBIR: `realocada` é
 * legado, continua sendo entendido e mostrado, mas ninguém marca uma sessão assim de novo —
 * oferecê-lo poria "Desmarcou" duas vezes no mesmo menu.
 */
export const STATUS_OFERECIDOS = ["realizada", "nao_realizada", "cancelada", "prof_desmarcou", "atestado"] as const;

/**
 * Quem gera cobrança quando a sessão não acontece.
 *
 * Faltou cobra: o paciente perdeu a sessão dele. Desmarcou, Prof. desm. e Atestado não cobram, e
 * é por isso que perguntar "esta sessão será cobrada?" nesses três não faz sentido nenhum — a
 * resposta é sempre não, e a pergunta só atrasa quem está no meio do dia.
 */
export const STATUS_QUE_PODEM_COBRAR = new Set(["realizada", "nao_realizada"]);

/** A legenda da agenda, montada a partir das cores de verdade para não haver duas versões delas. */
export const LEGENDA_DA_AGENDA = [
  "realizada",
  "nao_realizada",
  "cancelada",
  "prof_desmarcou",
  "atestado",
] as const;

/** Só o fundo e a borda de um status, para o quadradinho da legenda. */
export function corDaLegenda(status: string): { fundo: string; borda: string } {
  const CORES: Record<string, { fundo: string; borda: string }> = {
    realizada: { fundo: "#fef9c3", borda: "#eab308" },
    nao_realizada: { fundo: "#fecaca", borda: "#ef4444" },
    cancelada: { fundo: "#ede9fe", borda: "#c4b5fd" },
    prof_desmarcou: { fundo: "#f1f5f9", borda: "#cbd5e1" },
    atestado: { fundo: "#dbeafe", borda: "#93c5fd" },
  };
  return CORES[status] ?? { fundo: "transparent", borda: "#e5e7eb" };
}

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
    case "realocada":
    case "cancelada": return "bg-[#ede9fe] text-[#6d28d9]";     // Desmarcou — violeta
    case "nao_realizada": return "bg-[#fecaca] text-[#991b1b]";
    case "prof_desmarcou": return "bg-[#f1f5f9] text-[#475569]";
    case "atestado": return "bg-[#dbeafe] text-[#1e40af]";
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
