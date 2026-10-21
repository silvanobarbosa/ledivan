/**
 * "Valores recebidos" quebrados por FORMA de pagamento, com bruto e líquido (doc 50).
 *
 * Puro: recebe os pagamentos (valor + forma + data) e as vigências de taxa, e devolve o recebido por
 * forma (Pix/Deb/Cre/Din/Trans/Cartão legado), o total bruto e o total LÍQUIDO (só débito e crédito
 * descontam, pela taxa vigente na data de cada pagamento — [[taxaCartao]]). As somas usam o líquido.
 */

import { liquidoDoPagamento, FORMAS_COM_TAXA, type VigenciaTaxa } from "./taxaCartao";

export type PagamentoSimples = { valor: number; metodo: string | null | undefined; data: string };

/** Formas na ordem do doc, com rótulo curto. "card" = cartão antigo (sem split débito/crédito). */
export const FORMAS_RECEBIMENTO: { metodo: string; curto: string }[] = [
  { metodo: "pix", curto: "Pix" },
  { metodo: "debito", curto: "Deb" },
  { metodo: "credito", curto: "Cre" },
  { metodo: "credito_2x", curto: "Cre 2x" },
  { metodo: "credito_3x", curto: "Cre 3x" },
  { metodo: "credito_4x", curto: "Cre 4x" },
  { metodo: "credito_5x", curto: "Cre 5x" },
  { metodo: "dinheiro", curto: "Din" },
  { metodo: "cash", curto: "Din" },
  { metodo: "transferencia", curto: "Trans" },
  { metodo: "transfer", curto: "Trans" },
  { metodo: "card", curto: "Cartão" },
];
const CURTO = new Map(FORMAS_RECEBIMENTO.map((f) => [f.metodo, f.curto]));
/**
 * Quais formas mostram o líquido — vem de `FORMAS_COM_TAXA`, a MESMA fonte que decide o desconto.
 *
 * Aqui havia uma terceira lista escrita à mão, parada no 3x. Quando o doc 53 abriu 4x e 5x, o
 * líquido desses pagamentos passava a ser calculado certo e simplesmente não aparecia na tela —
 * a conta batia e o usuário via só o bruto. Uma lista que decide EXIBIÇÃO não pode viver longe
 * da lista que decide o CÁLCULO.
 */
const COM_TAXA = new Set(FORMAS_COM_TAXA);

export type FormaRecebida = { metodo: string; curto: string; bruto: number; liquido: number; temTaxa: boolean };
export type RecebidoResumo = { formas: FormaRecebida[]; totalBruto: number; totalLiquido: number };

/** Agrupa os pagamentos por forma e calcula bruto + líquido de cada uma e do total. */
export function recebidoPorForma(pagamentos: PagamentoSimples[], vigencias: VigenciaTaxa[]): RecebidoResumo {
  const porMetodo = new Map<string, { bruto: number; liquido: number }>();
  for (const p of pagamentos) {
    const metodo = p.metodo || "pix";
    const acc = porMetodo.get(metodo) ?? { bruto: 0, liquido: 0 };
    const v = Number(p.valor) || 0;
    acc.bruto += v;
    acc.liquido += liquidoDoPagamento(v, metodo, p.data, vigencias);
    porMetodo.set(metodo, acc);
  }

  const vistos = new Set<string>();
  const formas: FormaRecebida[] = [];
  // Ordem do doc; agrega "dinheiro"/"cash" e "transferencia"/"transfer" sob o mesmo rótulo curto.
  for (const { metodo, curto } of FORMAS_RECEBIMENTO) {
    const m = porMetodo.get(metodo);
    if (!m || m.bruto <= 0.005 || vistos.has(metodo)) continue;
    vistos.add(metodo);
    formas.push({ metodo, curto, bruto: m.bruto, liquido: m.liquido, temTaxa: COM_TAXA.has(metodo) });
  }
  // Qualquer forma fora da lista conhecida entra pelo próprio nome.
  for (const [metodo, m] of porMetodo) {
    if (vistos.has(metodo) || m.bruto <= 0.005) continue;
    formas.push({ metodo, curto: CURTO.get(metodo) ?? metodo, bruto: m.bruto, liquido: m.liquido, temTaxa: COM_TAXA.has(metodo) });
  }

  const totalBruto = formas.reduce((a, f) => a + f.bruto, 0);
  const totalLiquido = formas.reduce((a, f) => a + f.liquido, 0);
  return { formas, totalBruto, totalLiquido };
}
