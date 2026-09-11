/**
 * Quando o preço vence, e quanto o paciente paga no mês.
 *
 * Duas regras do dono moram aqui, e as duas são de dinheiro:
 *
 * 1. A validade do preço é contada em MESES a partir do início do tratamento. Se o paciente parou
 *    e voltou, a referência passa a ser a data do RETORNO — que é quando o status sai de inativo
 *    para ativo. Contar do início original faria o reajuste vencer no dia em que a pessoa volta,
 *    depois de meses sem atendimento.
 *
 * 2. O pacote mensal padrão é de 4 sessões. Quando é fragmentado, o terapeuta informa quantas
 *    semanas do mês tem atendimento e o sistema calcula as sessões — inclusive quando são duas ou
 *    mais por semana.
 *
 * Tudo aqui é função pura: decide, não grava.
 */

export type FormatoPagamento = "gratuito" | "sessao" | "mensal" | "quinzenal";

export const SESSOES_PACOTE_COMPLETO = 4;

/** O formato aceita valor e pacote? Gratuito não — é atendimento social. */
export function cobra(formato: FormatoPagamento | string | null | undefined): boolean {
  return formato !== "gratuito" && !!formato;
}

/**
 * A data de referência do preço: o retorno, se houve; senão, o início.
 *
 * Retorno é a data em que o paciente voltou a ficar ativo depois de um período inativo.
 */
export function referenciaDoPreco(inicio: Date | null | undefined, retorno: Date | null | undefined): Date | null {
  if (retorno && inicio) return retorno.getTime() > inicio.getTime() ? retorno : inicio;
  return retorno ?? inicio ?? null;
}

/** Quando o preço atual vence. `null` quando falta a referência ou a validade. */
export function vencimentoDoPreco(
  inicio: Date | null | undefined,
  retorno: Date | null | undefined,
  validadeMeses: number | null | undefined,
): Date | null {
  const base = referenciaDoPreco(inicio, retorno);
  if (!base || !validadeMeses || validadeMeses <= 0) return null;

  const d = new Date(base);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + validadeMeses);
  // 31 de janeiro + 1 mês vira 3 de março no JavaScript. Quando o mês novo não tem o dia, o
  // vencimento cai no último dia dele — que é o que uma pessoa entende por "daqui a um mês".
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

/** Quantos dias faltam para o reajuste. Negativo = já venceu. */
export function diasParaReajuste(vencimento: Date | null, hoje: Date = new Date()): number | null {
  if (!vencimento) return null;
  const dia = 24 * 60 * 60 * 1000;
  const a = Date.UTC(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / dia);
}

/**
 * Sessões previstas no mês.
 *
 * Pacote completo: 4, o padrão. Fragmentado: semanas de atendimento × vezes por semana — porque o
 * dono lembrou que pode haver mais de uma sessão na mesma semana.
 */
export function sessoesNoMes(opts: {
  pacote: "completo" | "fragmentado" | null | undefined;
  semanasNoMes?: number | null;
  vezesPorSemana?: number | null;
}): number {
  if (opts.pacote !== "fragmentado") return SESSOES_PACOTE_COMPLETO;
  const semanas = Math.max(0, Math.floor(opts.semanasNoMes ?? 0));
  const vezes = Math.max(1, Math.floor(opts.vezesPorSemana ?? 1));
  return semanas * vezes;
}

/** Quanto o paciente paga no mês, no formato escolhido. Gratuito é zero, sempre. */
export function valorDoMes(opts: {
  formato: FormatoPagamento | string | null | undefined;
  valorSessao: number;
  pacote?: "completo" | "fragmentado" | null;
  semanasNoMes?: number | null;
  vezesPorSemana?: number | null;
}): number {
  if (!cobra(opts.formato)) return 0;
  if (opts.formato === "sessao") return opts.valorSessao;   // paga por atendimento, não por mês
  const sessoes = sessoesNoMes({ pacote: opts.pacote, semanasNoMes: opts.semanasNoMes, vezesPorSemana: opts.vezesPorSemana });
  return Number((sessoes * opts.valorSessao).toFixed(2));
}

/**
 * O histórico de reajuste como a tela mostra: data, valor anterior e valor novo.
 *
 * O banco guarda só o valor que passou a valer em cada data. O "anterior" é o valor da linha de
 * antes — e a primeira linha não tem anterior, porque não houve reajuste: foi o preço de entrada.
 */
export function linhasDeReajuste(
  historico: { valor: string | number; dataEfetiva: Date | string }[],
): { data: Date; anterior: number | null; novo: number }[] {
  const ordenado = [...historico]
    .map((h) => ({ data: new Date(h.dataEfetiva), novo: Number(h.valor) }))
    .filter((h) => !Number.isNaN(h.data.getTime()) && !Number.isNaN(h.novo))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  return ordenado.map((linha, i) => ({
    data: linha.data,
    anterior: i === 0 ? null : ordenado[i - 1].novo,
    novo: linha.novo,
  }));
}
