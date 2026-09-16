/**
 * O QUE OCUPA CADA SLOT DA AGENDA, e como isso se lê na tela.
 *
 * Olhando uma semana cheia, a terapeuta precisa responder três perguntas sem clicar em nada:
 * *este horário está ocupado?*, *ocupado por quê?* e *tem alguma coisa errada com ele?*.
 *
 * A tela responde as três em canais separados, e a separação é o que faz a leitura funcionar:
 *
 * - **O TIPO de ocupação** é a forma do bloco: paciente, horário bloqueado, ou o espelho de um
 *   quinzenal.
 * - **O QUE ACONTECEU** é a cor de fundo, que segue a legenda de status.
 * - **OS FATOS** sobre aquela sessão são ícones, cada um com um significado só.
 *
 * Misturar os canais é o que apaga a informação: quando a cor diz duas coisas, ela deixa de dizer
 * qualquer uma.
 */

export type TipoDeOcupacao = "paciente" | "bloqueio" | "espelho_quinzenal";

/** Quem é quinzenal, mesmo quando a SESSÃO não guarda isso. */
export type PacienteQuinzenal = {
  id: string;
  /** O formato de pagamento (`quinzenal`) ou a frequência escrita no cadastro. */
  formato?: string | null;
  frequencia?: string | null;
};

/**
 * O paciente é atendido de quinze em quinze dias?
 *
 * A pergunta precisa olhar o CADASTRO, e não só a sessão. A frequência só é gravada na sessão
 * quando o agendamento nasce pela janela de repetição — e a base tem 43 pacientes quinzenais cujas
 * sessões não guardam isso, o que fazia o espelho da semana alternada nunca aparecer. Marca que
 * nunca aparece é marca que não existe.
 */
export function ehQuinzenal(p: PacienteQuinzenal | null | undefined): boolean {
  if (!p) return false;
  if (p.formato === "quinzenal") return true;
  return /quinzen/i.test(p.frequencia ?? "");
}

export type SessaoParaEspelho = {
  id: string;
  data: Date | string;
  duracao: number;
  pacienteId: string;
  /** Quando a própria sessão sabe que é quinzenal. */
  recorrenciaQuinzenal?: boolean;
};

export type Espelho = {
  pacienteId: string;
  hora: number;
  minuto: number;
  duracao: number;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const meioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Os espelhos de um dia: os horários em que um quinzenal NÃO acontece nesta semana.
 *
 * O espelho não é reserva — o horário está livre e outro paciente pode ocupá-lo, que é o pedido.
 * Ele existe para a semana alternada não parecer um buraco qualquer: aquele lugar pertence a um
 * combinado de quinze em quinze dias, e quem marcar ali toda semana empurra o dono para fora.
 */
export function espelhosDoDia(opts: {
  dia: Date;
  /** As sessões da janela inteira, para achar as que estão a sete dias daqui. */
  sessoes: SessaoParaEspelho[];
  /** Quem é quinzenal, por id de paciente. */
  quinzenal: (pacienteId: string) => boolean;
}): Espelho[] {
  const alvo = meioDia(opts.dia);
  const out: Espelho[] = [];
  const vistos = new Set<string>();

  // Já ocupado neste dia e horário? Então não é espelho: alguém encaixou.
  const ocupados = new Set(
    opts.sessoes
      .map((s) => ({ d: emData(s.data) }))
      .filter((s) => !Number.isNaN(s.d.getTime()) && meioDia(s.d) === alvo)
      .map((s) => `${s.d.getHours()}:${s.d.getMinutes()}`),
  );

  for (const s of opts.sessoes) {
    const d = emData(s.data);
    if (Number.isNaN(d.getTime())) continue;
    if (!(s.recorrenciaQuinzenal || opts.quinzenal(s.pacienteId))) continue;
    if (Math.abs(Math.round((meioDia(d) - alvo) / 86400000)) !== 7) continue;

    const chave = `${s.pacienteId}-${d.getHours()}:${d.getMinutes()}`;
    if (vistos.has(chave)) continue;
    if (ocupados.has(`${d.getHours()}:${d.getMinutes()}`)) continue;

    vistos.add(chave);
    out.push({ pacienteId: s.pacienteId, hora: d.getHours(), minuto: d.getMinutes(), duracao: s.duracao });
  }

  return out.sort((a, b) => a.hora * 60 + a.minuto - (b.hora * 60 + b.minuto));
}

/**
 * OS SINAIS DA CÉLULA.
 *
 * Cada um diz UMA coisa, e nenhum repete o que a cor já disse. O que não cabe em símbolo curto fica
 * de fora: ícone que precisa ser explicado não informa, decora.
 */
export type SinalDaCelula = {
  chave: string;
  /** O que ele significa, em palavras — vai no título e na legenda. */
  titulo: string;
};

export type FatosDaSessao = {
  online?: boolean | null;
  /**
   * O paciente pediu este horário pelo link público e ninguém confirmou ainda.
   *
   * NÃO é o mesmo que "sessão futura ainda não atendida": toda sessão de uma série nasce assim, e
   * acender um aviso em 83% da agenda futura esvazia o aviso. Só entra aqui o que pede resposta.
   */
  pedidoDoPaciente?: boolean | null;
  pacienteConfirmou?: boolean | null;
  pediuRemarcacao?: boolean | null;
  /** A sessão foi remarcada de outro dia. */
  realocada?: boolean | null;
  /** Reserva cujo dia já passou e ainda está sem desfecho — pede análise da terapeuta. */
  reservaVencida?: boolean | null;
};

/**
 * Os sinais que aquela sessão acende, na ordem em que aparecem.
 *
 * A ordem é de urgência: primeiro o que muda a conduta de hoje (o paciente chegou, pediu para
 * remarcar), depois o que é contexto (online, atrasado no pagamento).
 */
export function sinaisDaSessao(f: FatosDaSessao): SinalDaCelula[] {
  const out: SinalDaCelula[] = [];
  // Primeiro de todos: reserva vencida é uma pendência que só a terapeuta resolve, e some da vista
  // fácil (fica no passado). Acende antes do resto para não escapar.
  if (f.reservaVencida) out.push({ chave: "pendente", titulo: "Reserva vencida — analise o que aconteceu" });
  if (f.pediuRemarcacao) out.push({ chave: "remarcar", titulo: "Paciente pediu para remarcar" });
  if (f.realocada) out.push({ chave: "realocada", titulo: "Sessão remarcada de outra data" });
  if (f.pedidoDoPaciente) out.push({ chave: "pedido", titulo: "Pedido pelo link público — falta você confirmar" });
  if (f.pacienteConfirmou) out.push({ chave: "confirmou", titulo: "Paciente confirmou presença" });
  if (f.online) out.push({ chave: "online", titulo: "Atendimento online" });
  return out;
}
