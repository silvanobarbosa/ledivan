/**
 * AS REGRAS DA JANELA DE NOVO AGENDAMENTO.
 *
 * A janela em si é tela; o que mora aqui são as decisões que ela toma e que valem a pena poder
 * conferir sem abrir o navegador: que modalidades cada tipo de atendimento oferece, quais
 * repetições cabem em cada caso, e o que "confirmar sessão" grava.
 */

export type Modalidade = "presencial" | "online" | "misto";
export type Repeticao = "pontual" | "semanal" | "quinzenal" | "mensal" | "mes" ;
export type CanalDeConfirmacao = "nenhum" | "whatsapp" | "email";

export const MODALIDADES: { valor: Modalidade; rotulo: string }[] = [
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "online", rotulo: "Online" },
  { valor: "misto", rotulo: "Misto" },
];

/**
 * As modalidades que cada tipo de atendimento oferece.
 *
 * A devolutiva não tem "Misto" — foi o que elas pediram, e faz sentido: misto é um combinado de
 * longo prazo com o paciente (uma semana online, outra na sala), e a devolutiva é um encontro
 * único com os responsáveis. Ou é numa sala ou é numa chamada.
 */
export function modalidadesDe(tipo: string | null | undefined): { valor: Modalidade; rotulo: string }[] {
  return tipo === "devolutiva" ? MODALIDADES.filter((m) => m.valor !== "misto") : MODALIDADES;
}

export const REPETICOES: { valor: Repeticao; rotulo: string }[] = [
  { valor: "pontual", rotulo: "Não repetir" },
  { valor: "semanal", rotulo: "Semanal (1x na semana)" },
  { valor: "quinzenal", rotulo: "Quinzenal" },
  { valor: "mensal", rotulo: "Mensal" },
];

/**
 * As repetições que a janela oferece.
 *
 * A devolutiva não se repete: é um encontro único, e uma devolutiva semanal não é uma coisa que
 * exista. E um horário "Q" — o slot intercalado de um paciente quinzenal — oferece uma lista
 * diferente, sem o semanal: se o novo paciente ocupasse todas as semanas, o horário deixaria de
 * ser intercalado e o quinzenal original perderia o lugar dele.
 */
export function repeticoesDe(opts: { tipo?: string | null; slotIntercalado?: boolean }): { valor: Repeticao; rotulo: string }[] {
  if (opts.tipo === "devolutiva") return [REPETICOES[0]];
  if (opts.slotIntercalado) {
    return [
      { valor: "pontual", rotulo: "Não repetir" },
      { valor: "mes", rotulo: "1x no mês" },
      { valor: "quinzenal", rotulo: "A cada quinzena" },
    ];
  }
  return REPETICOES;
}

/**
 * A repetição gera as sessões seguintes automaticamente?
 *
 * Semanal e quinzenal sim. **Mensal não**, e é uma decisão delas: em vez de encher a agenda de
 * meses à frente, o paciente entra numa lista de "Lembrar agendamento" no Dashboard no fim do mês.
 * Quem atende uma vez por mês costuma combinar a data na própria sessão, e uma agenda cheia de
 * datas presumidas atrapalha mais do que ajuda.
 */
export function geraRepeticoes(repeticao: string | null | undefined): boolean {
  return repeticao === "semanal" || repeticao === "quinzenal";
}

/** Repetição que precisa de uma data final. É a mesma lista de quem gera repetições. */
export function pedeRepetirAte(repeticao: string | null | undefined): boolean {
  return geraRepeticoes(repeticao);
}

export const CANAIS_DE_CONFIRMACAO: { valor: CanalDeConfirmacao; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Não confirmar" },
  { valor: "whatsapp", rotulo: "Por WhatsApp" },
  { valor: "email", rotulo: "Por e-mail" },
];

/** O campo "quantas horas antes" só aparece quando há canal escolhido. */
export function pedeHorasAntes(canal: string | null | undefined): boolean {
  return canal === "whatsapp" || canal === "email";
}

/** O que vai para o banco no canal de confirmação. "Não confirmar" é ausência, não o texto. */
export function canalParaGravar(canal: string | null | undefined): CanalDeConfirmacao | null {
  return canal === "whatsapp" || canal === "email" ? canal : null;
}

/**
 * Quantas horas antes, dentro do que faz sentido.
 *
 * Menos de uma hora não dá tempo de o paciente responder; mais de uma semana, ele esquece que
 * confirmou. Sem canal escolhido, não há o que gravar.
 */
export function horasAntesParaGravar(canal: string | null | undefined, horas: unknown): number | null {
  if (!pedeHorasAntes(canal)) return null;
  if (horas === null || horas === undefined || horas === "") return 24;
  const n = Math.floor(Number(horas));
  if (!Number.isFinite(n)) return 24;
  return Math.min(168, Math.max(1, n));
}

/** `isOnline` continua existindo e é lido por meia dúzia de telas; sai da modalidade. */
export function ehOnline(modalidade: string | null | undefined): boolean {
  return modalidade === "online";
}

/** Só faz sentido escolher local quando há encontro presencial — e misto também tem. */
export function pedeLocal(modalidade: string | null | undefined): boolean {
  return modalidade === "presencial" || modalidade === "misto";
}
