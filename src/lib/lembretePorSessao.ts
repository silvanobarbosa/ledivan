/**
 * O LEMBRETE NA ANTECEDÊNCIA DE CADA SESSÃO (dono, 13/11/2026).
 *
 * O agendamento sempre teve o campo "quantas horas antes" — e ele era gravado e **nunca lido por
 * envio nenhum**. Quem mandava era o cron de turno (doc 61): 6h da manhã para as sessões do dia,
 * 15h para as de amanhã, escolha única valendo para todos os pacientes. Duas peças com o mesmo
 * nome, uma sem efeito.
 *
 * Agora cada sessão manda na hora dela. O cron passa a rodar de hora em hora, e é esta função que
 * decide quem entra em cada passada.
 *
 * O QUE NÃO MUDA: o turno antigo continua valendo para as sessões que não têm antecedência própria
 * — todo o passado está assim. Desligar o caminho velho junto faria o consultório parar de avisar
 * os pacientes já agendados, sem ninguém pedir.
 *
 * Funções puras: errar aqui é mandar mensagem a paciente de madrugada, e isso não se testa
 * esperando a madrugada chegar.
 */

export type SessaoComLembrete = {
  id: string;
  /** A data/hora da sessão, em hora de parede. */
  date: Date | string;
  /** `whatsapp` manda; `nenhum`, `email` e nulo não. */
  confirmChannel?: string | null;
  /** Quantas horas antes da sessão o lembrete sai. */
  confirmLeadHours?: number | null;
  /** Já enviado? A marca é o que garante mensagem única mesmo se o cron repetir. */
  reminderSentAt?: Date | string | null;
};

const HORA = 60 * 60 * 1000;

/**
 * O AGORA NO MESMO RELÓGIO DAS SESSÕES.
 *
 * A coluna é `timestamp` sem fuso e guarda hora de PAREDE; o driver monta "15:00" como 15:00Z
 * (ver `horaLocal.ts`). O processo na Vercel roda em UTC. Comparar `new Date()` com essas datas
 * erra por TRÊS HORAS — e o sintoma seria o pior possível: lembrete chegando na hora errada, sem
 * nada quebrar em lugar nenhum.
 *
 * O Brasil não tem mais horário de verão, então o deslocamento é fixo — é a mesma conta que o cron
 * já fazia para descobrir a hora de Brasília.
 */
export function agoraEmParede(utc: Date): Date {
  return new Date(utc.getTime() - 3 * HORA);
}

/** Esta sessão deve ser avisada NESTE instante? */
export function horaDeDisparar(agora: Date, s: SessaoComLembrete): boolean {
  if (s.reminderSentAt) return false;
  // O canal é só o WhatsApp (13/11). `email` sobrou em agendamentos antigos: ressuscitá-lo aqui
  // seria religar um canal que o dono desligou no produto inteiro.
  if (s.confirmChannel !== "whatsapp") return false;

  const horas = Number(s.confirmLeadHours);
  if (!Number.isFinite(horas) || horas <= 0) return false;

  const quando = new Date(s.date).getTime();
  if (Number.isNaN(quando)) return false;

  const t = agora.getTime();
  /**
   * A janela abre na antecedência pedida e FECHA quando a sessão começa.
   *
   * Passada a hora, o lembrete deixou de servir e vira constrangimento — "não esqueça da sua
   * sessão de ontem". Se o cron ficou fora do ar a tarde inteira, perder o aviso é melhor do que
   * mandá-lo errado.
   */
  return t >= quando - horas * HORA && t < quando;
}

/** As sessões que entram nesta passada do cron. */
export function sessoesParaLembrarAgora<T extends SessaoComLembrete>(agora: Date, sessoes: T[]): T[] {
  return sessoes.filter((s) => horaDeDisparar(agora, s));
}
