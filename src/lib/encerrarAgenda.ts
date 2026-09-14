/**
 * QUANDO O PACIENTE VIRA INATIVO: o que sai da agenda e o que fica.
 *
 * Passar alguém para inativo é dizer que o tratamento acabou. Mas a agenda continua cheia de
 * quartas-feiras marcadas até o fim do ano, e elas não somem sozinhas — ficam ocupando horário
 * que poderia ser de outro paciente, aparecendo no "sessões do dia", entrando na previsão de
 * receita e empurrando a sequência do pacote. Na prática, a pessoa apaga uma a uma, ou desiste.
 *
 * A regra que elas escreveram separa as duas coisas com precisão:
 *
 * - **Sai** o que está marcado DEPOIS da mudança e ainda não tem status. São horários reservados
 *   para um tratamento que não vai mais acontecer.
 * - **Fica** tudo que já tem status — Presente, Faltou, Desmarcou, Prof. desm., Atestado. Aquilo
 *   aconteceu, e apagar seria reescrever o histórico do paciente para arrumar a agenda.
 *
 * A fronteira é o INSTANTE da mudança, não o dia. Quem encerra às 15h de uma terça não quer perder
 * a sessão das 9h daquela mesma terça, que já aconteceu e ainda pode estar sem status porque a
 * pessoa não teve tempo de marcar.
 */

/** O status de quem ainda não recebeu status nenhum. */
export const SEM_STATUS = "agendada";

export type SessaoDoEncerramento = {
  id: string;
  data: Date | string;
  status: string;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/**
 * Quais sessões apagar ao encerrar o tratamento.
 *
 * Devolve ids. Quem decide apagar é quem chama — esta função só diz quais, e por isso dá para
 * conferir cada caso sem tocar no banco.
 */
export function sessoesAEncerrar(opts: {
  sessoes: SessaoDoEncerramento[];
  /** O instante em que o cadastro virou inativo. */
  quando?: Date;
}): string[] {
  const corte = opts.quando ?? new Date();
  if (Number.isNaN(corte.getTime())) return [];

  return opts.sessoes
    .map((s) => ({ id: s.id, data: emData(s.data), status: s.status }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .filter((s) => s.data.getTime() > corte.getTime())
    .filter((s) => s.status === SEM_STATUS)
    .map((s) => s.id);
}

/**
 * A mudança de status encerra a agenda?
 *
 * Só a saída para INATIVO. "Pausado" é outra coisa: quem pausa pretende voltar, e apagar a agenda
 * dele seria obrigar a remarcar tudo na volta — é justamente a diferença entre os dois estados.
 * E prospecto nem chegou a ter tratamento para encerrar.
 */
export function encerraAgenda(de: string | null | undefined, para: string | null | undefined): boolean {
  return para === "inativo" && de !== "inativo";
}
