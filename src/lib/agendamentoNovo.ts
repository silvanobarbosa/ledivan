/**
 * AS REGRAS DA JANELA DE NOVO AGENDAMENTO.
 *
 * A janela em si é tela; o que mora aqui são as decisões que ela toma e que valem a pena poder
 * conferir sem abrir o navegador: que modalidades cada tipo de atendimento oferece, quais
 * repetições cabem em cada caso, e o que "confirmar sessão" grava.
 */

export type Modalidade = "presencial" | "online" | "misto";
export type Repeticao = "pontual" | "semanal" | "semanal2x" | "quinzenal" | "mensal" | "mes" ;
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

/** Dias da semana no padrão do `Date`: o índice é o `getDay()`. */
export const DIAS_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const REPETICOES: { valor: Repeticao; rotulo: string }[] = [
  { valor: "pontual", rotulo: "Não repetir" },
  { valor: "semanal", rotulo: "Semanal (1x na semana)" },
  { valor: "semanal2x", rotulo: "Semanal (2x na semana)" },
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
  return repeticao === "semanal" || repeticao === "semanal2x" || repeticao === "quinzenal";
}

/**
 * A repetição marca DOIS dias na semana?
 *
 * Quem vem 2x por semana fecha pacote de oito, não de quatro (documento de 18/09) — e é esta
 * escolha, na janela do agendamento, que passa isso ao cadastro do paciente.
 */
export function ehSemanal2x(repeticao: string | null | undefined): boolean {
  return repeticao === "semanal2x";
}

/** "14:05" a partir de uma data. */
function horario(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * O segundo atendimento da semana foi informado por completo?
 *
 * Só a repetição 2x na semana pede segundo dia e horário. As duas sessões **podem cair no mesmo
 * dia da semana**, em horários diferentes (dona, 18/09) — segunda 14h e segunda 16h é um combinado
 * de duas por semana como qualquer outro.
 *
 * O que não vale é repetir dia E horário: seria a mesma sessão duas vezes, e o pacote contaria oito
 * onde só quatro aconteceram.
 *
 * `segundoDia` é o dia da semana no padrão do `Date`: 0 = domingo.
 */
export function segundoDiaValido(
  repeticao: string | null | undefined,
  segundoDia: number | null | undefined,
  segundoHorario: string | null | undefined,
  primeira?: Date,
): boolean {
  if (!ehSemanal2x(repeticao)) return true;
  if (segundoDia == null || !Number.isFinite(segundoDia)) return false;
  if (!segundoHorario) return false;
  if (primeira && primeira.getDay() === segundoDia && horario(primeira) === segundoHorario) return false;
  return true;
}

/**
 * As datas que a repetição gera, em ordem de calendário.
 *
 * Mora aqui, fora da action, porque é regra e não acesso a banco — e porque o 2x na semana
 * intercala duas séries, que é exatamente o tipo de conta que se quer ver escrita num teste.
 */
/**
 * As datas da repeticao E as que ela pulou por horario bloqueado.
 *
 * Duas funcoes porque quase todo mundo so quer as datas; quem cria a serie precisa tambem saber o
 * que ficou de fora, para registrar a falta e a guia Geral poder mostrar "Hor. Bloq." na linha.
 */
export function datasEPuladas(opts: {
  primeira: Date;
  limite: Date;
  freq: string | null | undefined;
  /** Dia da semana do segundo atendimento (0 = domingo), só no 2x na semana. */
  segundoDia?: number | null;
  /** "HH:MM" do segundo atendimento. */
  segundoHorario?: string | null;
  /**
   * A data esta bloqueada? (documento de 18/09)
   *
   * *"Se o horario estiver bloqueado, o agendamento nao devera ser realizado nesta data. O sistema
   * devera pular a data do bloqueio e procurar a proxima data disponivel, mantendo a sequencia."*
   *
   * O bloqueio mora em tabela propria, longe das sessoes — e so isso que ele faz aqui: impedir que
   * a data vire agendamento. Sem a funcao, nada e pulado.
   */
  bloqueado?: (quando: Date) => boolean;
}): { datas: Date[]; puladas: Date[] } {
  const { primeira, limite, freq } = opts;
  const passo = freq === "quinzenal" ? 14 : 7;
  const datas: Date[] = [];

  const livre = (d: Date) => !opts.bloqueado?.(d);
  const puladas: Date[] = [];

  for (const d = new Date(primeira); d <= limite && datas.length < 260; d.setDate(d.getDate() + passo)) {
    if (livre(d)) datas.push(new Date(d));
    else puladas.push(new Date(d));
  }

  if (ehSemanal2x(freq) && opts.segundoDia != null && opts.segundoHorario) {
    const [h, m] = String(opts.segundoHorario).split(":").map((x) => Number(x) || 0);
    // A primeira ocorrência do segundo dia é a próxima DEPOIS da primeira sessão: se o dia
    // escolhido já passou nesta semana, ele começa na semana seguinte.
    const segunda = new Date(primeira);
    segunda.setHours(h, m, 0, 0);
    // Mesmo dia da semana: o segundo atendimento e na MESMA data, noutro horario. Dia diferente: a
    // proxima ocorrencia depois da primeira sessao — se o dia escolhido ja passou nesta semana, ele
    // comeca na semana seguinte.
    if (opts.segundoDia !== primeira.getDay()) {
      do { segunda.setDate(segunda.getDate() + 1); } while (segunda.getDay() !== opts.segundoDia);
    }

    for (const d = new Date(segunda); d <= limite && datas.length < 520; d.setDate(d.getDate() + 7)) {
      if (livre(d)) datas.push(new Date(d));
      else puladas.push(new Date(d));
    }
    datas.sort((x, y) => x.getTime() - y.getTime());
  }

  puladas.sort((x, y) => x.getTime() - y.getTime());
  return { datas, puladas };
}

/** So as datas. E o que quase todo chamador quer. */
export function datasDaRepeticao(opts: Parameters<typeof datasEPuladas>[0]): Date[] {
  return datasEPuladas(opts).datas;
}

/**
 * É uma repetição mensal?
 *
 * "Mensal" e "1x no mês" (a opção do slot intercalado) são a mesma coisa com dois nomes. Nenhuma
 * das duas gera sessões; as duas põem o paciente na lista de "Lembrar agendamento".
 */
export function ehMensal(repeticao: string | null | undefined): boolean {
  return repeticao === "mensal" || repeticao === "mes";
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
