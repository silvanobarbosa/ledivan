/**
 * Taxa de cartão com VIGÊNCIA — o cálculo ÚNICO do valor líquido (doc 49).
 *
 * Regras da casa:
 *  - O valor BRUTO nunca muda (Guia Dados / Guia Geral mostram o cheio).
 *  - Em qualquer TOTAL RECEBIDO, desconta-se a taxa UMA vez, usando a taxa vigente na DATA DO
 *    PAGAMENTO — nunca a taxa atual. Mudar a taxa não recalcula o passado.
 *  - Só débito e crédito têm taxa. Pix, dinheiro e qualquer outra forma: líquido = bruto.
 *
 * Função pura e centralizada para a taxa ser descontada uma única vez, em um único lugar.
 */

export type VigenciaTaxa = {
  /** Data a partir da qual esta configuração vale (ISO; só a parte YYYY-MM-DD importa). */
  validFrom: string;
  debito: number; // %
  credito: number; // % crédito à vista
  credito2x?: number | null; // % crédito 2x (doc 50)
  credito3x?: number | null; // % crédito 3x (doc 50)
  credito4x?: number | null; // % crédito 4x (doc 53)
  credito5x?: number | null; // % crédito 5x (doc 53)
};

/**
 * As formas de cartão que sofrem taxa, e de qual campo da vigência cada uma tira o percentual.
 *
 * É um mapa, e não uma cadeia de `if`, porque a lista cresce: nasceu com débito e crédito à vista
 * (doc 49), ganhou 2x e 3x (doc 50) e agora 4x e 5x (doc 53). Com o mapa, incluir uma parcela é
 * uma linha — e a lista de formas permitidas sai dele, sem poder divergir.
 */
const CAMPO_DA_FORMA: Record<string, (t: VigenciaTaxa) => number> = {
  debito: (t) => t.debito,
  credito: (t) => t.credito,
  credito_2x: (t) => t.credito2x ?? 0,
  credito_3x: (t) => t.credito3x ?? 0,
  credito_4x: (t) => t.credito4x ?? 0,
  credito_5x: (t) => t.credito5x ?? 0,
};

/** As formas que passam pela taxa. Qualquer outra (pix, dinheiro, transferência) sai pelo bruto. */
export const FORMAS_COM_TAXA = Object.keys(CAMPO_DA_FORMA);

/** Só a parte YYYY-MM-DD de um ISO/Date, para comparar vigência sem passar por fuso. */
function dia(iso: string | null | undefined): string {
  return String(iso ?? "").slice(0, 10);
}

/**
 * A taxa vigente numa data: a vigência mais recente cujo início (validFrom) é <= a data do
 * pagamento. Devolve null se não houver nenhuma vigência até aquela data (pagamento é anterior à
 * primeira taxa cadastrada → sem desconto).
 */
export function taxaVigenteEm(dataISO: string, vigencias: VigenciaTaxa[]): VigenciaTaxa | null {
  const d = dia(dataISO);
  if (!d) return null;
  let escolhida: VigenciaTaxa | null = null;
  for (const v of vigencias) {
    if (dia(v.validFrom) <= d && (!escolhida || dia(v.validFrom) > dia(escolhida.validFrom))) {
      escolhida = v;
    }
  }
  return escolhida;
}

function pctDaForma(method: string, taxa: VigenciaTaxa): number {
  return CAMPO_DA_FORMA[method]?.(taxa) ?? 0;
}

/**
 * Valor líquido de UM pagamento, conforme a forma e a taxa vigente na data dele. Débito, crédito
 * à vista, crédito 2x e 3x descontam o % próprio; qualquer outra forma (ou sem vigência/taxa zero)
 * devolve o próprio valor.
 */
export function liquidoDoPagamento(valor: number, method: string | null | undefined, dataISO: string, vigencias: VigenciaTaxa[]): number {
  if (!Number.isFinite(valor) || valor <= 0 || !method) return valor;
  if (!FORMAS_COM_TAXA.includes(method)) return valor;
  const taxa = taxaVigenteEm(dataISO, vigencias);
  if (!taxa) return valor;
  const pct = pctDaForma(method, taxa);
  if (!pct || pct <= 0) return valor;
  return Math.round(valor * (1 - pct / 100) * 100) / 100;
}
