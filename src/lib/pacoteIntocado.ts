/**
 * A PRIMEIRA SEQUÊNCIA QUE AINDA NÃO COMEÇOU A ACONTECER.
 *
 * Doc 73 (dono): *"Ao escolher pacote a iniciar, ele precisa verificar qual o pacote (sequência)
 * não tem nenhum status lançado e corrigir a partir deste."*
 *
 * O que estava errado antes: "próximo pacote a iniciar" valia da DATA que a terapeuta digitou em
 * "Vale a partir de". Com data retroativa (01/08/2025, medido na base), o valor novo caía em
 * pacotes de meses atrás que já tinham acontecido e já estavam pagos — o oposto do que a escolha
 * promete.
 *
 * `agendada` é o status de quem ainda não aconteceu. Qualquer outro — realizada, não realizada,
 * cancelada, prof. desmarcou, atestado — é a terapeuta tendo lançado alguma coisa ali, e um
 * pacote onde já se lançou não é "o próximo a iniciar".
 *
 * A resposta é usada UMA VEZ, na hora de salvar o reajuste, para congelar a data de vigência.
 * Deixar a regra viva no motor faria o reajuste escorregar para a frente a cada status novo — e
 * nunca entrar em vigor.
 *
 * Função pura.
 */

export type SessaoParaIntocado = {
  date: Date | string;
  status?: string | null;
  /** O número da sequência (pacote) a que ela pertence. */
  sequencia: number;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/** A sessão ainda não teve nada lançado nela. */
export function semStatusLancado(status?: string | null): boolean {
  const s = (status ?? "agendada").trim() || "agendada";
  return s === "agendada";
}

/**
 * O DIA em que começa a primeira sequência sem nenhum status lançado — `null` quando todas já
 * têm alguma coisa lançada (aí não existe "próximo pacote" ainda conhecido).
 */
export function inicioDoPacoteIntocado(sessoes: SessaoParaIntocado[]): Date | null {
  const porSequencia = new Map<number, { inicio: Date; intocada: boolean }>();
  for (const s of sessoes) {
    const d = emData(s.date);
    if (Number.isNaN(d.getTime())) continue;
    const atual = porSequencia.get(s.sequencia);
    if (!atual) porSequencia.set(s.sequencia, { inicio: d, intocada: semStatusLancado(s.status) });
    else {
      if (d.getTime() < atual.inicio.getTime()) atual.inicio = d;
      if (!semStatusLancado(s.status)) atual.intocada = false;
    }
  }
  const emOrdem = [...porSequencia.entries()].sort((a, b) => a[0] - b[0]);
  const achada = emOrdem.find(([, v]) => v.intocada);
  return achada ? achada[1].inicio : null;
}

/**
 * A VIGÊNCIA QUE VAI SER GRAVADA quando a resposta é "próximo pacote a iniciar".
 *
 * Empurra a data escolhida para o começo do primeiro pacote intocado, **nunca para trás**: se a
 * terapeuta escolheu uma data ainda mais à frente, é a dela que vale — ela sabe algo que a agenda
 * não conta. Sem pacote intocado, fica como ela escolheu.
 */
export function vigenciaDoProximoPacote(escolhida: Date, sessoes: SessaoParaIntocado[]): Date {
  const inicio = inicioDoPacoteIntocado(sessoes);
  if (!inicio) return escolhida;
  const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  return dia.getTime() > escolhida.getTime() ? dia : escolhida;
}
