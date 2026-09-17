/**
 * O QUE A CÉLULA DA AGENDA ESCREVE.
 *
 * Uma célula tem o tamanho de um bloco de cinquenta minutos numa coluna de um sétimo da tela.
 * Cabem duas linhas curtas, e é por isso que o lote das beta testers trocou o NOME do paciente por
 * uma identificação curta mais um código: quem olha a semana não precisa ler o nome inteiro de
 * cada um, precisa saber de quem é aquele horário e o que aquela sessão é.
 *
 * O código responde a uma pergunta só — *que sessão é esta?* — e nunca a outra, que é *está paga?*.
 * Situação de pagamento é assunto da tela de fechamento; misturar as duas aqui faria a agenda
 * mentir toda vez que alguém quitasse um mês.
 *
 * As regras, na ordem em que elas as escreveram:
 *
 * | A sessão é | A célula escreve |
 * | --- | --- |
 * | devolutiva | `DEVOL` |
 * | devolutiva que abate do pacote | `DEVOL` e a posição na sequência |
 * | consulta de quem é atendido de graça | `GRAT` |
 * | consulta de quem paga a cada sessão | `AVUL` |
 * | consulta de quem fecha por pacote | a posição na sequência, `2/4` |
 *
 * Mais a câmera quando o atendimento é online, e a letra da repetição ao lado da identificação.
 */

import { usaPacote } from "./reajuste";

export type DadosDaCelula = {
  /** A identificação na agenda, o campo que a terapeuta preenche no cadastro. */
  agendaId?: string | null;
  /** O número de registro, sequencial por terapeuta. Serve de reserva. */
  registro?: number | null;
  /** O nome, última reserva de todas. */
  nome?: string | null;
  formato?: string | null;
  /** `consulta` ou `devolutiva`. */
  tipo?: string | null;
  /** Devolutiva marcada para abater do pacote: não cobra, mas ocupa posição na sequência. */
  abateDoPacote?: boolean | null;
  posicao?: { index: number; total: number } | null;
  online?: boolean | null;
  /** `semanal`, `quinzenal` ou `mensal`, quando o agendamento se repete. */
  repeticao?: string | null;
  /** O agendamento se repete. Pode ser verdade sem a frequência ser conhecida. */
  recorrente?: boolean | null;
  /**
   * O rótulo já resolvido pelo motor de cobranças (`rotulosDasSessoes`), pelo formato do DIA da
   * sessão. Quando vem, manda: o `formato` daqui é o de hoje e erraria as sessões antigas.
   */
  codigo?: string | null;
};

/**
 * A identificação curta do paciente.
 *
 * O campo próprio vem primeiro, mas ele é OPCIONAL no cadastro e costuma estar vazio. Sem uma
 * reserva, a célula ficaria muda — e célula muda numa agenda é pior do que nome comprido. Por isso
 * cai no número de registro e, na falta dele, no primeiro nome.
 */
export function identificacao(dados: DadosDaCelula): string {
  const proprio = (dados.agendaId ?? "").trim();
  if (proprio) return proprio;

  const registro = Number(dados.registro);
  if (Number.isFinite(registro) && registro > 0) return String(registro).padStart(4, "0");

  const nome = (dados.nome ?? "").trim();
  if (nome) return nome.split(/\s+/)[0];

  return "—";
}

const LETRA_DA_REPETICAO: Record<string, string> = {
  quinzenal: "Q",
  mensal: "M",
};

/**
 * A letra da repetição, entre parênteses, ao lado da identificação.
 *
 * Só (M) e (Q), que foi o pedido. Cheguei a acrescentar (S) para o semanal e as testers pediram
 * para tirar: o semanal é o ritmo PADRÃO de quem faz terapia, então a letra apareceria em quase
 * toda célula e não distinguiria ninguém — só gastaria espaço. Quem foge do padrão é que precisa
 * de marca.
 *
 * Repetição sem frequência conhecida devolve `null` aqui, e a célula marca com um ícone genérico:
 * a base tem 111 sessões nessa situação, e silêncio nelas seria perder a informação de vez.
 */
export function letraDaRepeticao(repeticao?: string | null): string | null {
  return LETRA_DA_REPETICAO[repeticao ?? ""] ?? null;
}

/** `2/4`, ou nada quando a sessão não pertence a uma sequência. */
export function posicaoEmTexto(posicao?: { index: number; total: number } | null): string | null {
  if (!posicao) return null;
  const { index, total } = posicao;
  if (!Number.isFinite(index) || !Number.isFinite(total) || total < 1) return null;
  return `${index}/${total}`;
}

/**
 * O código da sessão: a segunda linha da célula.
 *
 * Devolutiva vem primeiro de propósito. Ela é um tipo de encontro, não um formato de cobrança, e
 * por isso manda no rótulo mesmo quando o paciente fecha por pacote — o que a terapeuta precisa
 * enxergar ali é que aquele horário não é uma consulta.
 */
export function codigoDaSessao(dados: DadosDaCelula): string {
  const posicao = posicaoEmTexto(dados.posicao);

  if (dados.tipo === "devolutiva") {
    return dados.abateDoPacote && posicao ? `DEVOL ${posicao}` : "DEVOL";
  }

  if (dados.formato === "gratuito") return "GRAT";
  if (dados.formato === "sessao") return "AVUL";
  if (usaPacote(dados.formato) && posicao) return posicao;

  return "";
}

export type ConteudoDaCelula = {
  /** A primeira linha: identificação e, quando se repete, a letra entre parênteses. */
  identificacao: string;
  repeticao: string | null;
  /** A segunda linha. Vazia quando não há o que dizer. */
  codigo: string;
  online: boolean;
  /** Repete, mas sem frequência conhecida: a célula marca com um ícone em vez de letra. */
  repeteSemLetra: boolean;
};

/** Tudo que a célula escreve, numa chamada só. */
export function conteudoDaCelula(dados: DadosDaCelula): ConteudoDaCelula {
  const letra = letraDaRepeticao(dados.repeticao);
  return {
    identificacao: identificacao(dados),
    repeticao: letra,
    codigo: dados.codigo ?? codigoDaSessao(dados),
    online: !!dados.online,
    repeteSemLetra: !letra && !!dados.recorrente,
  };
}

/**
 * A devolutiva ocupa posição na sequência?
 *
 * Só quando foi marcada para abater do pacote. É o que "abater" quer dizer: não gera cobrança, mas
 * consome uma sessão da sequência. A devolutiva comum acontece FORA do pacote — contá-la roubaria
 * uma consulta do paciente.
 */
export function entraNaSequencia(sessao: { sessionKind?: string | null; abaterDoPacote?: boolean | null }): boolean {
  if (sessao.sessionKind !== "devolutiva") return true;
  return !!sessao.abaterDoPacote;
}
