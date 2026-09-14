/**
 * QUANTAS SESSÕES O PACIENTE TEVE NAQUELE MÊS.
 *
 * Só isso. A POSIÇÃO de cada sessão (1/4, 2/4…) mudou de casa: mora em `sequenciaPacote.ts`, que
 * agrupa por sequência em vez de por mês do calendário — uma sequência de setembro empurrada por
 * um atestado termina em outubro, e o mês deixou de ser o agrupador.
 *
 * O que ficou aqui é a contagem pelo CALENDÁRIO, que continua sendo uma pergunta legítima: a tela
 * do fechamento mostra quantas sessões houve no mês ao lado do que o mês cobra, justamente porque
 * os dois números podem divergir.
 *
 * Sessão que pausa a sequência não conta: não houve atendimento, e o paciente não perde a sessão.
 *
 * Função pura: conta, não grava.
 */

import { STATUS_QUE_PAUSAM } from "./therapy";

export type SessaoDoPacote = { id: string; date: Date | string; status: string };

/**
 * Quem não conta: não houve atendimento, e o paciente não perde a sessão.
 *
 * São exatamente os status que PAUSAM a sequência. Prof. desm. e Atestado entraram com o lote das
 * beta testers e pertencem aqui pelo mesmo motivo das outras: cobrar por sessão que o profissional
 * desmarcou, ou por falta com atestado, é cobrar por atendimento que não houve.
 */
const FORA = STATUS_QUE_PAUSAM;

export function ativasEmOrdem(sessoes: SessaoDoPacote[]): { id: string; data: Date }[] {
  return sessoes
    .filter((s) => !FORA.has(s.status))
    .map((s) => ({ id: s.id, data: s.date instanceof Date ? s.date : new Date(s.date) }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime());
}

/** Quantas sessões o paciente tem dentro daquele mês (base 0 para janeiro, como no JavaScript). */
export function sessoesDoMes(sessoes: SessaoDoPacote[], ano: number, mes: number): number {
  return ativasEmOrdem(sessoes).filter((s) => s.data.getFullYear() === ano && s.data.getMonth() === mes).length;
}
