/**
 * OS STATUS QUE DIZEM "NÃO ACONTECEU" — num lugar só.
 *
 * O enum tem sete status, e quatro deles significam a mesma coisa para quem conta volume de
 * atendimento: o encontro foi desfeito. `cancelada` e `realocada` são as duas formas de o
 * PACIENTE desmarcar (a guia Geral rotula as duas como "Desmarcou"); `prof_desmarcou` é o
 * profissional desmarcando; `atestado` é a falta justificada, que o consultório não atendeu.
 *
 * Esta lista já existia espalhada — em `fechamento.ts` por comentário, em `desfazerCobranca.ts`
 * como parâmetro padrão — e faltava justamente onde o dono viu o erro: o cartão "Sessões na
 * semana" contava TODAS as linhas da semana, então uma semana inteira desmarcada aparecia cheia.
 * Lista copiada é lista que diverge; aqui ela é uma só.
 */

/** Não houve atendimento: desmarcada pelos dois lados, remarcada, ou falta com atestado. */
export const STATUS_QUE_NAO_ACONTECERAM = ["cancelada", "realocada", "prof_desmarcou", "atestado"] as const;

/** O mesmo conjunto, para quem testa pertinência em laço. */
export const SET_QUE_NAO_ACONTECERAM: ReadonlySet<string> = new Set(STATUS_QUE_NAO_ACONTECERAM);

/** A sessão conta como volume de agenda? (expectativa `agendada`, presença, ou falta sem atestado) */
export function aconteceu(status: string | null | undefined): boolean {
  return !SET_QUE_NAO_ACONTECERAM.has(status ?? "");
}

/**
 * COMO O STATUS SE CHAMA NA TELA. Era um mapa privado da guia Geral; virou público quando o
 * cartão "Sessões do dia" passou a mostrar o dia inteiro e precisou dizer em que pé está cada
 * sessão. Duas tabelas de rótulo para o mesmo enum é como o mesmo status vira dois nomes.
 *
 * `agendada` não aparece aqui de propósito: na lista do dia, "agendada" é o estado normal e um
 * selo em toda linha é ruído. Quem não tem rótulo é o que ainda vai acontecer.
 */
export const ROTULO_DO_STATUS: Record<string, string> = {
  realizada: "Presente", nao_realizada: "Faltou", cancelada: "Desmarcou",
  realocada: "Desmarcou", prof_desmarcou: "Prof. desm.", atestado: "Atestado",
};
