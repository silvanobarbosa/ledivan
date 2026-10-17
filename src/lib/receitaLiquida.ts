import "server-only";

import { getVigenciasTaxa } from "@/lib/cardFees";
import { liquidoDoPagamento } from "@/lib/taxaCartao";

/**
 * Netter de receita de um terapeuta (doc 49): carrega as vigências de taxa UMA vez e devolve uma
 * função que converte (valor bruto, forma, data) no valor LÍQUIDO. Ponto ÚNICO de desconto — assim a
 * taxa é aplicada uma só vez, de forma consistente, em todos os "totais recebidos" do sistema.
 *
 * Uso: `const net = await carregarNetter(userId); total += net(valor, method, dataISO);`
 */
export async function carregarNetter(userId: string): Promise<(valor: number, method: string | null | undefined, dataISO: string) => number> {
  const vigencias = await getVigenciasTaxa(userId);
  return (valor, method, dataISO) => liquidoDoPagamento(valor, method, dataISO, vigencias);
}
