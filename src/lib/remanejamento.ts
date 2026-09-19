import { STATUS_QUE_PAUSAM } from "./therapy";

/**
 * REMANEJAR A AGENDA DEPOIS DE DESBLOQUEAR UM HORÁRIO.
 *
 * Quando a série pulou uma data por causa de um bloqueio e o horário é liberado, a dona quer poder
 * devolver a sequência para lá (19/09): *"a sequência deverá ser reorganizada para que a sessão
 * ocupe aquela data"*.
 *
 * **Cada sessão anda para a data da anterior, em cascata.** A primeira que pode andar ocupa a vaga,
 * a seguinte toma o lugar dela, e assim por diante. Não é preciso saber se a série é semanal ou
 * quinzenal: o intervalo já está nas próprias datas. Deduzir o ritmo seria inventar um que a
 * terapeuta pode ter mudado à mão numa sessão do meio.
 *
 * O que NÃO anda: sessão anterior à vaga (o passado não se remonta) e sessão que já teve desfecho —
 * realizada, faltou, desmarcada. Mover uma sessão que aconteceu reescreveria o histórico.
 *
 * Função pura: decide os movimentos, não os aplica.
 */

export type SessaoParaRemanejar = {
  id: string;
  date: Date | string;
  status: string;
};

export type Movimento = {
  id: string;
  de: Date;
  para: Date;
};

const emData = (d: Date | string) => (d instanceof Date ? d : new Date(d));

/** Já teve desfecho? Então ficou onde está. */
const jaAconteceu = (status: string) =>
  status === "realizada" || status === "nao_realizada" || STATUS_QUE_PAUSAM.has(status);

export function remanejamento(vaga: Date, sessoes: SessaoParaRemanejar[]): Movimento[] {
  const candidatas = sessoes
    .map((s) => ({ ...s, data: emData(s.date) }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .filter((s) => s.data.getTime() > vaga.getTime())
    .filter((s) => !jaAconteceu(s.status))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  const movimentos: Movimento[] = [];
  let destino = vaga;
  for (const s of candidatas) {
    movimentos.push({ id: s.id, de: s.data, para: destino });
    destino = s.data;
  }
  return movimentos;
}
