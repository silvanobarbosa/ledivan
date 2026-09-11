/**
 * A contagem de sessões do pacote — 1/3, 2/3, 3/3 — feita pelo CALENDÁRIO, não por um número
 * digitado no cadastro.
 *
 * Regra do dono, com o exemplo dele: atendimento toda quarta às 8h, começando em 16/09.
 *
 *   16/09 → 1/3   07/10 → 1/4
 *   23/09 → 2/3   14/10 → 2/4
 *   30/09 → 3/3   21/10 → 3/4
 *                 28/10 → 4/4
 *
 * Ou seja, no pacote FRAGMENTADO o total é quantas sessões caem dentro daquele mês, e setembro
 * com três quartas-feiras cobra três sessões. No pacote COMPLETO são sempre quatro: a sequência
 * vai de 1/4 a 4/4 e recomeça, atravessando a virada do mês.
 *
 * Sessão cancelada ou realocada sai da conta, e as seguintes renumeram sozinhas — senão o
 * paciente pagaria por uma sessão que não houve.
 *
 * Função pura: conta, não grava. O valor do mês é este total × o valor da sessão.
 */

export const SESSOES_PACOTE_COMPLETO = 4;

export type SessaoDoPacote = { id: string; date: Date | string; status: string };
export type PosicaoNoPacote = { index: number; total: number };

/** Cancelada e realocada não contam: não houve atendimento. */
const FORA = new Set(["cancelada", "realocada"]);

const chaveDoMes = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function ativasEmOrdem(sessoes: SessaoDoPacote[]): { id: string; data: Date }[] {
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

/**
 * A posição de cada sessão no pacote: mapa de id da sessão para `{ index, total }`.
 *
 * Fragmentado conta por mês; completo é uma sequência contínua de quatro que reinicia.
 */
export function numeracaoDoPacote(
  sessoes: SessaoDoPacote[],
  pacote: "completo" | "fragmentado" | null | undefined,
): Map<string, PosicaoNoPacote> {
  const ordenadas = ativasEmOrdem(sessoes);
  const mapa = new Map<string, PosicaoNoPacote>();

  if (pacote === "fragmentado") {
    const porMes = new Map<string, { id: string; data: Date }[]>();
    for (const s of ordenadas) {
      const k = chaveDoMes(s.data);
      porMes.set(k, [...(porMes.get(k) ?? []), s]);
    }
    for (const doMes of porMes.values()) {
      doMes.forEach((s, i) => mapa.set(s.id, { index: i + 1, total: doMes.length }));
    }
    return mapa;
  }

  ordenadas.forEach((s, i) => {
    mapa.set(s.id, { index: (i % SESSOES_PACOTE_COMPLETO) + 1, total: SESSOES_PACOTE_COMPLETO });
  });
  return mapa;
}

/**
 * Quanto o pacote daquele mês custa: total de sessões × valor da sessão.
 *
 * A tela que vai cobrar ainda não existe — o dono pediu para a lógica já ficar pronta e certa.
 */
export function valorDoPacote(valorSessao: number, totalDeSessoes: number): number {
  if (!(valorSessao > 0) || !(totalDeSessoes > 0)) return 0;
  return Number((valorSessao * totalDeSessoes).toFixed(2));
}
