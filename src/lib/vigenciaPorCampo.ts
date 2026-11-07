/**
 * A VIGÊNCIA É DO CAMPO QUE MUDOU, NÃO DA TELA (doc 62).
 *
 * O Financeiro tem um campo só de data — "Vale a partir de" — e vários campos que guardam o
 * próprio histórico: valor da sessão, formato, tamanho do pacote, dia do vencimento, "pagar até",
 * intervalo de reajuste. Cada um grava a sua vigência quando muda, e isso já funcionava.
 *
 * O que não funcionava era o caso do doc 75: quando a pessoa mexia SÓ na data, o app entendia
 * "corrija a vigência do preço" e movia a data do último preço gravado. A intenção era boa — é
 * como se corrige uma vigência digitada errada —, mas a condição era frouxa demais: bastava ter
 * tocado na data. Alterar só o intervalo de reajuste, com vigência 01/11, mexia também na
 * vigência do VALOR DA SESSÃO, que ninguém tinha tocado.
 *
 * A regra do dono: *"quando somente um campo for alterado, somente ele deverá receber a nova
 * vigência"*. Então a data só corrige a vigência do preço quando o preço é a única coisa em jogo —
 * isto é, quando nenhum outro campo financeiro mudou nesta gravação. Mudou outro, a data é dele.
 *
 * Funções puras.
 */

/** Os campos financeiros que carregam vigência própria. O nome é o que aparece no histórico. */
export type CampoFinanceiro =
  | "valor"
  | "formato"
  | "pacote"
  | "sessoes"
  | "vencimento"
  | "vencimento2"
  | "pagarAte"
  | "reajuste";

/** Um retrato dos campos financeiros, do jeito que estão gravados ou do jeito que chegaram. */
export type RetratoFinanceiro = Partial<Record<CampoFinanceiro, unknown>>;

/** Vazio e nulo são a mesma ausência: sem isto, trocar `null` por `""` contaria como mudança. */
const texto = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

/** Quais campos financeiros mudaram entre o que estava gravado e o que foi enviado. */
export function camposFinanceirosAlterados(antes: RetratoFinanceiro, depois: RetratoFinanceiro): CampoFinanceiro[] {
  const campos = new Set<CampoFinanceiro>([...Object.keys(antes), ...Object.keys(depois)] as CampoFinanceiro[]);
  return [...campos].filter((c) => texto(antes[c]) !== texto(depois[c]));
}

/**
 * A data digitada deve CORRIGIR a vigência do preço já gravado?
 *
 * Só quando a pessoa mexeu na data, a data é mesmo outra, e **nada mais** mudou nesta gravação.
 * O preço entre os campos alterados também tira a correção de cena: aí não se corrige vigência,
 * grava-se um preço novo, que é outro caminho.
 */
export function dataCorrigeVigenciaDoPreco(opts: {
  vigenciaEditada: boolean;
  /** `null` quando a data não veio ou não é válida. */
  dataNova: Date | null;
  /** A vigência do preço mais recente já gravado. */
  dataAtual: Date | null | undefined;
  alterados: CampoFinanceiro[];
}): boolean {
  if (!opts.vigenciaEditada) return false;
  if (!opts.dataNova || Number.isNaN(opts.dataNova.getTime())) return false;
  if (!opts.dataAtual || mesmoDia(opts.dataNova, opts.dataAtual)) return false;
  return opts.alterados.length === 0;
}

/** Mesmo dia de parede — comparar o instante acusaria diferença por causa da hora. */
export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
