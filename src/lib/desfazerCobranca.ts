/**
 * DESFAZER A COBRANÇA DE UMA SESSÃO QUE JÁ FOI PAGA (doc 55).
 *
 * A terapeuta marcou "Faltou", respondeu que a sessão seria cobrada, e depois mudou de ideia. Até
 * aqui é simples: o valor sai e a sessão volta a ser gratuita. O caso difícil é quando o paciente
 * JÁ PAGOU — aí há dinheiro recebido preso a uma cobrança que vai deixar de existir, e sumir com a
 * linha sem dizer nada é a pior saída possível numa tela de dinheiro.
 *
 * O dono pediu que o sistema PERGUNTE, com duas saídas:
 *
 * - **Estornar**: o pagamento é apagado. O dinheiro sai de todas as somas sozinho, porque elas
 *   derivam dos pagamentos — não há total guardado para corrigir. Fica o registro do estorno, que
 *   é o que permite à guia Geral dizer para onde o valor foi em vez de a linha só esvaziar.
 * - **Transferir**: o pagamento passa a valer para a PRÓXIMA sessão, com a data original intacta.
 *   É o caso de quem pagou adiantado e a sessão não aconteceu — o crédito segue com o paciente.
 *
 * Este arquivo decide O QUE fazer; quem escreve no banco é a action. A separação é de propósito:
 * a escolha de qual pagamento move para qual sessão é a parte que precisa de teste, e testar isso
 * contra o banco seria lento e frágil.
 *
 * Função pura.
 */

export type PagamentoDaSessao = {
  id: string;
  valor: number;
  /** A cobrança a que ele está preso hoje. */
  cobrancaChave: string | null;
};

export type SessaoNaLinha = {
  id: string;
  date: Date | string;
  /** Status atual — uma sessão que não aconteceu não recebe pagamento transferido. */
  status: string;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/**
 * A PRÓXIMA sessão que pode receber o pagamento transferido.
 *
 * "Próxima" é pela data, a partir da sessão que está sendo desfeita — e precisa ser uma sessão que
 * ainda vai acontecer ou aconteceu: transferir para uma desmarcada só adiaria o mesmo problema, e
 * para uma que também está sendo dispensada criaria um crédito circulando sem destino.
 */
export function proximaSessaoParaReceber(
  sessaoAtualId: string,
  todas: SessaoNaLinha[],
  naoRecebem: ReadonlySet<string> = new Set(["cancelada", "realocada", "prof_desmarcou", "atestado"]),
): SessaoNaLinha | null {
  const atual = todas.find((s) => s.id === sessaoAtualId);
  if (!atual) return null;
  const quando = emData(atual.date).getTime();
  if (Number.isNaN(quando)) return null;

  return (
    todas
      .filter((s) => s.id !== sessaoAtualId && !naoRecebem.has(s.status))
      .map((s) => ({ s, t: emData(s.date).getTime() }))
      .filter((x) => !Number.isNaN(x.t) && x.t > quando)
      .sort((a, b) => a.t - b.t || a.s.id.localeCompare(b.s.id))
      .map((x) => x.s)[0] ?? null
  );
}

export type DecisaoDeDesfazer =
  | { acao: "nada" }
  | { acao: "estornar"; pagamentoId: string; valor: number }
  | { acao: "transferir"; pagamentoId: string; valor: number; paraSessaoId: string; novaChave: string };

/**
 * O que fazer com o pagamento, dada a escolha da terapeuta.
 *
 * Sem pagamento, não há pergunta nem decisão: o documento é explícito — "caso não exista pagamento,
 * o sistema deverá executar diretamente o comportamento já definido para a opção Não".
 *
 * Transferir sem uma próxima sessão não é possível, e devolver "nada" seria mentir: o pagamento
 * ficaria preso a uma cobrança extinta. Quem chama precisa saber para oferecer o estorno.
 */
export function decidirDesfazer(opts: {
  escolha: "estornar" | "transferir" | null;
  pagamento: PagamentoDaSessao | null;
  sessaoAtualId: string;
  sessoes: SessaoNaLinha[];
}): DecisaoDeDesfazer | { erro: string } {
  const { escolha, pagamento } = opts;
  if (!pagamento) return { acao: "nada" };
  if (!escolha) return { erro: "Esta sessão tem pagamento lançado: diga o que fazer com ele." };

  if (escolha === "estornar") {
    return { acao: "estornar", pagamentoId: pagamento.id, valor: pagamento.valor };
  }

  const proxima = proximaSessaoParaReceber(opts.sessaoAtualId, opts.sessoes);
  if (!proxima) return { erro: "Não há sessão seguinte para receber este pagamento. Estorne o valor." };
  return {
    acao: "transferir",
    pagamentoId: pagamento.id,
    valor: pagamento.valor,
    paraSessaoId: proxima.id,
    // A cobrança de uma sessão avulsa/extra é sempre `extra:<id da sessão>` — ver `cobrancas.ts`.
    novaChave: `extra:${proxima.id}`,
  };
}
