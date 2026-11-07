/**
 * QUANDO UMA SEQUÊNCIA NOVA COMEÇA, AS DATAS PINADAS À MÃO DEPOIS DO PONTO SAEM (doc 20).
 *
 * O botão promete, com estas palavras: *"Sim desloca o mês das próximas parcelas (sem pagamento),
 * mantendo os dias e anos"*. O doc 19 trocou a lista de datas por uma REGRA — a partir de tal
 * vencimento, tudo anda tantos meses —, e o motor aplica a regra primeiro e as datas explícitas
 * depois, porque uma data escolhida a dedo tem de ganhar da conta.
 *
 * A consequência é que uma data pinada ANTES, por uma sequência que já não vale, continuava
 * ganhando da regra nova: na Celani, as 28 parcelas futuras tinham data própria gravada pelo
 * comportamento antigo, e o "Sim" não movia nada. A promessa do botão não se cumpria, em silêncio.
 *
 * A regra nova manda do seu ponto em diante, e isso inclui apagar os pins daquele trecho — eles
 * pertencem à sequência anterior. Fora da conta ficam a cobrança que está sendo editada (a data
 * dela é justamente o que a pessoa acabou de escolher) e qualquer cobrança COM pagamento, que é o
 * "(sem pagamento)" do próprio botão: dinheiro lançado não muda de vencimento.
 */
export type CobrancaParaSequencia = {
  chave: string;
  /** O vencimento que o motor calcula, antes de qualquer deslocamento ou pin. */
  vencimentoNatural?: string | null;
  vencimento?: string | null;
  pago: boolean;
};

const dia = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

/** As chaves cujo pin de vencimento pertence à sequência anterior e deve sair. */
export function pinsDaSequenciaAnterior(
  cobrancas: CobrancaParaSequencia[],
  opts: { aPartirDe: string; excluir: string },
): string[] {
  const ponto = dia(opts.aPartirDe);
  if (!ponto) return [];
  const fora = new Set<string>();
  for (const c of cobrancas) {
    if (c.chave === opts.excluir || c.pago) continue;
    const d = dia(c.vencimentoNatural) ?? dia(c.vencimento);
    if (d && d >= ponto) fora.add(c.chave);
  }
  return [...fora];
}
