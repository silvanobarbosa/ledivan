import { recebePagamento } from "@/lib/desfazerCobranca";

/**
 * PARA ONDE VAI O CRÉDITO QUE ESTÁ ESPERANDO (doc 59).
 *
 * Até aqui o crédito só era abatido quando a terapeuta LANÇAVA um pagamento: ela abria a cobrança,
 * digitava o valor, e o saldo entrava para fechar o que faltava. O documento pede o contrário —
 * "ao identificar uma próxima sessão AVUL ou X/X, acrescentar esse valor e os dados de pagamento
 * nesta próxima sessão". Quer dizer: assim que existir onde usar, o crédito vai sozinho.
 *
 * Faz sentido, porque o crédito nasceu de uma sessão que não aconteceu. O paciente já pagou; não
 * há decisão nenhuma a tomar, só um lugar novo para o dinheiro que ele adiantou. Obrigá-la a
 * lançar à mão um pagamento que já foi feito é pedir que ela repita o que o sistema sabe.
 *
 * Esta é a regra pura: decide, não grava.
 *
 * O que ela garante, e que o documento cobra em letra:
 *
 * - **Só sessão com o que pagar.** `AVUL` ou `X/X` — e a cobrança do pacote, que é como as X/X se
 *   pagam. Mandar crédito para uma GRAT seria pagar uma sessão gratuita, e o dinheiro sumiria
 *   dentro de uma cobrança que não existe.
 * - **Nunca acumulativo.** Cada crédito é usado UMA vez: quem foi aplicado sai da lista, e o que
 *   sobra de uma aplicação parcial continua como saldo, não como uma segunda sugestão do mesmo
 *   valor.
 * - **Parcial deixa a diferença em aberto; excedente continua disponível.** Nenhum dos dois é
 *   arredondado para "pago": a cobrança recebe no máximo o que ela deve.
 */

const TOL = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type CobrancaAberta = {
  chave: string;
  /** O rótulo da sessão (`AVUL`, `2/4`, `GRAT`…) — é ele que diz se a cobrança pode receber. */
  rotulo?: string | null;
  /**
   * O tipo da cobrança. `pacote` e `quinzena` são a cobrança DAS sessões X/X — elas não trazem
   * rótulo próprio, porque uma linha cobre várias sessões, e recusá-las por isso deixaria de fora
   * justamente metade do que o documento manda atender.
   */
  tipo?: string | null;
  /** Quanto ainda falta receber nesta cobrança. */
  falta: number;
  /** A sessão a que ela pertence, para o pagamento de crédito apontar para o atendimento certo. */
  sessaoId: string | null;
  /** A data da sessão — é ela que a mensagem da sessão de ORIGEM vai citar. */
  data: Date;
};

export type CreditoDisponivel = {
  id: string;
  valor: number;
  /** O pagamento que gerou este crédito. Os dados dele seguem junto: data, forma, quem pagou. */
  origemPagamentoId: string | null;
};

export type AplicacaoDeCredito = {
  creditoId: string;
  /** Quanto deste crédito entra nesta cobrança. */
  valor: number;
  /** O que sobrou dele depois disto — vira uma linha nova de saldo, nunca uma sugestão repetida. */
  sobra: number;
  chave: string;
  sessaoId: string | null;
  dataDaSessao: Date;
  origemPagamentoId: string | null;
};

/**
 * As aplicações, em ordem: crédito mais antigo primeiro, cobrança mais antiga primeiro.
 *
 * Mais antigo primeiro porque é a ordem em que o dinheiro entrou e em que as sessões aconteceram —
 * qualquer outra faria o extrato contar uma história que não foi a que se viveu.
 */
export function aplicacoesDeCredito(
  cobrancas: CobrancaAberta[],
  creditos: CreditoDisponivel[],
): AplicacaoDeCredito[] {
  const elegiveis = cobrancas
    .filter((c) => c.falta > TOL && (c.tipo === "pacote" || c.tipo === "quinzena" || recebePagamento(c.rotulo)))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.chave.localeCompare(b.chave));

  const saldos = creditos.map((c) => ({ ...c, resta: Math.max(0, r2(c.valor)) })).filter((c) => c.resta > TOL);
  const out: AplicacaoDeCredito[] = [];

  for (const cob of elegiveis) {
    let falta = r2(cob.falta);
    for (const cred of saldos) {
      if (falta <= TOL) break;
      if (cred.resta <= TOL) continue;
      const usa = r2(Math.min(cred.resta, falta));
      cred.resta = r2(cred.resta - usa);
      falta = r2(falta - usa);
      out.push({
        creditoId: cred.id,
        valor: usa,
        sobra: cred.resta,
        chave: cob.chave,
        sessaoId: cob.sessaoId,
        dataDaSessao: cob.data,
        origemPagamentoId: cred.origemPagamentoId,
      });
    }
  }
  return out;
}
