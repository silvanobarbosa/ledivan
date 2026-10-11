/**
 * As DATAS DOS ATENDIMENTOS que cada recibo cobre (doc 28).
 *
 * O recibo não lista a data do pagamento — lista as datas das SESSÕES que aquele pagamento cobriu.
 * Quantas sessões um pagamento cobre vem do valor: `valor / valor da sessão`. E a emissão é
 * SEQUENCIAL: o 1º pagamento pega as primeiras datas; o 2º pega as próximas; e assim por diante,
 * sem repetir data já usada por um recibo anterior da mesma sequência. Por isso a conta é feita
 * sobre a lista de pagamentos NA ORDEM DE LANÇAMENTO, consumindo as sessões em ordem cronológica.
 *
 * Só entram sessões que a pessoa pagou: Presente (`realizada`) e Faltou (`nao_realizada`). Desmarcou
 * (`cancelada`/`realocada`), Prof. desmarcou (`prof_desmarcou`) e Atestado (`atestado`) ficam de fora
 * — não se cobra atendimento que não houve.
 *
 * Tudo aqui é função pura: decide, não busca. Sem estado guardado — a sequência é determinística a
 * partir da ordem dos pagamentos, das sessões e do valor da sessão.
 */

export const SESSOES_NO_RECIBO = new Set(["realizada", "nao_realizada"]);

export type SessaoParaRecibo = { data: Date; status: string };
export type PagamentoParaRecibo = { id: string; valor: number };

/**
 * Datas do recibo de UM pagamento, mais se ele é PARCIAL (não fecha um número inteiro de sessões) e,
 * nesse caso, a data em que o pacote começou (a 1ª sessão da janela daquele pagamento).
 */
export function datasDoRecibo(opts: {
  pagamentos: PagamentoParaRecibo[]; // ordem de LANÇAMENTO
  alvoId: string;
  sessoes: SessaoParaRecibo[];       // todas as sessões do paciente
  valorSessao: number;
}): { datas: Date[]; parcial: boolean; inicioPacote: Date | null } {
  const validas = opts.sessoes
    .filter((s) => SESSOES_NO_RECIBO.has(s.status) && s.data instanceof Date && !Number.isNaN(s.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  const vs = opts.valorSessao;
  let ptr = 0;
  for (const pg of opts.pagamentos) {
    const inicio = ptr;
    // Quantas sessões INTEIRAS este pagamento cobre. Com valor da sessão ausente/zero, nenhuma.
    const n = vs > 0 ? Math.floor(pg.valor / vs + 1e-9) : 0;
    const resto = vs > 0 ? pg.valor - n * vs : 0;
    const datas = validas.slice(inicio, inicio + n).map((s) => s.data);
    ptr = inicio + n;
    if (pg.id === opts.alvoId) {
      const parcial = resto > 0.005;
      const inicioPacote = parcial ? (validas[inicio]?.data ?? datas[0] ?? null) : null;
      return { datas, parcial, inicioPacote };
    }
  }
  return { datas: [], parcial: false, inicioPacote: null };
}
