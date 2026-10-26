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
  /**
   * O rótulo da célula: `AVUL`, `2/4`, `GRAT`, `DEVOL`…
   *
   * Doc 57: só é ELEGÍVEL para receber o pagamento a sessão `AVUL` ou `X/X`, porque são as que têm
   * o que pagar. Mandar o dinheiro para uma GRAT seria pagar uma sessão gratuita — o crédito
   * desapareceria dentro de uma cobrança que não existe.
   */
  rotulo?: string | null;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/**
 * A PRÓXIMA sessão que pode receber o pagamento transferido.
 *
 * "Próxima" é pela data, a partir da sessão que está sendo desfeita — e precisa ser uma sessão que
 * ainda vai acontecer ou aconteceu: transferir para uma desmarcada só adiaria o mesmo problema, e
 * para uma que também está sendo dispensada criaria um crédito circulando sem destino.
 */
/**
 * AS CHAVES DE COBRANÇA QUE PODEM PRENDER DINHEIRO A UMA SESSÃO.
 *
 * Uma sessão sozinha é cobrada de duas maneiras, e a chave é diferente em cada uma:
 *
 * - `sessao:<id>` — o paciente é do formato "a cada sessão" (Avulso). É a cobrança NORMAL dele.
 * - `extra:<id>`  — a sessão é extra `avul`, ou é a gratuita que virou cobrada por falta. Essa
 *   cobrança nasce fora do formato do paciente.
 *
 * Procurar só por `extra:` era o defeito do doc 58: no paciente Avulso o pagamento tem chave
 * `sessao:`, então o app não encontrava o dinheiro, não perguntava nada, e desfazia a cobrança
 * deixando o pagamento solto. Solto, ele não some — cai na distribuição por vencimento da guia
 * Geral e vai ABATER a próxima cobrança, que é justamente o que a terapeuta viu acontecer.
 *
 * As duas nunca coexistem para a mesma sessão (uma é do formato, a outra é de fora dele), então
 * procurar pelas duas acha o pagamento sem risco de achar dois.
 */
export function chavesDaCobrancaDaSessao(sessionId: string): [string, string] {
  return [`extra:${sessionId}`, `sessao:${sessionId}`];
}

/** `AVUL` ou `X/X` — as que têm o que pagar (doc 57). */
export function recebePagamento(rotulo: string | null | undefined): boolean {
  const r = String(rotulo ?? "").trim().toUpperCase();
  if (r.startsWith("AVUL")) return true;
  return /\d+\s*\/\s*\d+/.test(r);
}

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
      // Elegível = tem o que pagar (AVUL ou X/X) E aconteceu ou vai acontecer. Sem rótulo, não dá
      // para afirmar que tem cobrança — e adivinhar aqui é mandar dinheiro para o lugar errado.
      .filter((s) => s.id !== sessaoAtualId && !naoRecebem.has(s.status) && recebePagamento(s.rotulo))
      .map((s) => ({ s, t: emData(s.date).getTime() }))
      .filter((x) => !Number.isNaN(x.t) && x.t > quando)
      .sort((a, b) => a.t - b.t || a.s.id.localeCompare(b.s.id))
      .map((x) => x.s)[0] ?? null
  );
}

export type DecisaoDeDesfazer =
  | { acao: "nada" }
  | { acao: "estornar"; pagamentoId: string; valor: number }
  | { acao: "transferir"; pagamentoId: string; valor: number; paraSessaoId: string; novaChave: string }
  /**
   * Doc 57: não há próxima sessão elegível, e o dinheiro NÃO se perde nem vira estorno — fica como
   * crédito, esperando a próxima sessão que tenha o que pagar.
   *
   * Antes eu recusava a transferência e mandava estornar. Recusar era melhor do que deixar o
   * pagamento órfão, mas obrigava a terapeuta a devolver um dinheiro que o paciente não pediu de
   * volta — ele continua cliente, e a sessão seguinte simplesmente ainda não foi marcada.
   */
  | { acao: "creditar"; pagamentoId: string; valor: number };

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
  // Sem destino, o valor VIRA CRÉDITO — não se perde nem se devolve (doc 57).
  if (!proxima) return { acao: "creditar", pagamentoId: pagamento.id, valor: pagamento.valor };
  return {
    acao: "transferir",
    pagamentoId: pagamento.id,
    valor: pagamento.valor,
    paraSessaoId: proxima.id,
    // A cobrança de uma sessão avulsa/extra é sempre `extra:<id da sessão>` — ver `cobrancas.ts`.
    novaChave: `extra:${proxima.id}`,
  };
}
