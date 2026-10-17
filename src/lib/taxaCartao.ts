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
  credito: number; // %
};

/** Só a parte YYYY-MM-DD de um ISO/Date, para comparar vigência sem passar por fuso. */
function dia(iso: string | null | undefined): string {
  return String(iso ?? "").slice(0, 10);
}

/**
 * A taxa vigente numa data: a vigência mais recente cujo início (validFrom) é <= a data do
 * pagamento. Devolve null se não houver nenhuma vigência até aquela data (pagamento é anterior à
 * primeira taxa cadastrada → sem desconto).
 */
export function taxaVigenteEm(dataISO: string, vigencias: VigenciaTaxa[]): { debito: number; credito: number } | null {
  const d = dia(dataISO);
  if (!d) return null;
  let escolhida: VigenciaTaxa | null = null;
  for (const v of vigencias) {
    if (dia(v.validFrom) <= d && (!escolhida || dia(v.validFrom) > dia(escolhida.validFrom))) {
      escolhida = v;
    }
  }
  return escolhida ? { debito: escolhida.debito, credito: escolhida.credito } : null;
}

/**
 * Valor líquido de UM pagamento, conforme a forma e a taxa vigente na data dele. Débito/crédito
 * descontam o %; qualquer outra forma (ou sem vigência/taxa zero) devolve o próprio valor.
 */
export function liquidoDoPagamento(valor: number, method: string | null | undefined, dataISO: string, vigencias: VigenciaTaxa[]): number {
  if (!Number.isFinite(valor) || valor <= 0) return valor;
  if (method !== "debito" && method !== "credito") return valor;
  const taxa = taxaVigenteEm(dataISO, vigencias);
  if (!taxa) return valor;
  const pct = method === "debito" ? taxa.debito : taxa.credito;
  if (!pct || pct <= 0) return valor;
  return Math.round(valor * (1 - pct / 100) * 100) / 100;
}
