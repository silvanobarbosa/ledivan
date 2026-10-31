import { parseMoedaBR } from "./money";

/**
 * COMO ESTA DEVOLUTIVA DEVE SER CONSIDERADA?
 *
 * A devolutiva é o encontro com os responsáveis, e ela tem duas perguntas próprias que nenhuma
 * outra sessão tem. Até o doc 68 elas eram duas caixinhas soltas ("Cobrar esta devolutiva",
 * "Abater do pacote"), e a combinação das duas era um enigma: marcar cobrar E abater, ou nenhuma
 * das duas, produzia estados que ninguém sabia descrever.
 *
 * Agora é uma escolha de cada vez, no mesmo formato do quadro da sequência:
 *
 *   Como esta devolutiva deve ser considerada?
 *     [ Cobrar devolutiva ]  [ Não cobrar devolutiva ]
 *
 *   Cobrar      → quanto? (valor próprio)
 *   Não cobrar  → [ Abater da sequência do pacote ] [ Não abater da sequência do pacote ]
 *
 * **A devolutiva cobrada vira uma EXTRA AVULSA.** Não é detalhe de implementação: é o que lhe dá
 * valor próprio e faz vencer no instante do atendimento, que foi o pedido. O caminho já existia
 * para a sessão fora da sequência, com cobrança, vencimento e tudo o mais testado — inventar um
 * segundo caminho para a mesma coisa seria criar uma segunda verdade sobre dinheiro.
 *
 * **Abater ≠ não abater** é sobre a NUMERAÇÃO: abatendo, a devolutiva ocupa uma posição e a
 * sequência avança; não abatendo, ela não avança — o mesmo que acontece com uma desmarcada.
 *
 * Funções puras.
 */

/** O que foi escolhido no quadro. `null` = ainda não escolheu. */
export type EscolhaDaDevolutiva = "cobrar" | "nao_cobrar" | null;
export type AbatimentoDaDevolutiva = "abater" | "nao_abater" | null;

export const TITULO_DA_DEVOLUTIVA = "Como esta devolutiva deve ser considerada?";

export const OPCOES_DA_DEVOLUTIVA = [
  { valor: "cobrar" as const, rotulo: "Cobrar devolutiva" },
  { valor: "nao_cobrar" as const, rotulo: "Não cobrar devolutiva" },
];

export const OPCOES_DO_ABATIMENTO = [
  { valor: "abater" as const, rotulo: "Abater da sequência do pacote" },
  { valor: "nao_abater" as const, rotulo: "Não abater da sequência do pacote" },
];

export type DevolutivaAGravar =
  | { ok: true; chargeable: boolean; abaterDoPacote: boolean; extra: "avul" | null; valorExtra: string | null }
  | { ok: false; error: string };

/**
 * O que gravar a partir do quadro — e o que RECUSAR.
 *
 * Recusa em vez de adivinhar: sem escolha, sem valor, ou com valor zerado, a sessão não nasce.
 * Uma devolutiva gravada "no escuro" aparece depois como cobrança que ninguém reconhece.
 */
export function devolutivaParaGravar(o: {
  escolha: EscolhaDaDevolutiva;
  valor?: string | null;
  abatimento?: AbatimentoDaDevolutiva;
  /**
   * Doc 70: o paciente está num formato SEM sequência de pacote (gratuito)?
   *
   * Então a segunda pergunta não existe — não há sequência para abater, e pedir que se escolha
   * entre "abater" e "não abater" é pedir uma decisão sobre uma coisa que não está lá.
   */
  semSequencia?: boolean;
}): DevolutivaAGravar {
  if (o.escolha === "cobrar") {
    const valor = parseMoedaBR(o.valor);
    if (valor == null || Number(valor) <= 0) return { ok: false, error: "Informe o valor da devolutiva." };
    // Cobrada = extra avulsa: valor próprio, cobrança própria, vencendo no horário do atendimento.
    return { ok: true, chargeable: true, abaterDoPacote: false, extra: "avul", valorExtra: valor };
  }

  if (o.escolha === "nao_cobrar") {
    if (o.semSequencia) return { ok: true, chargeable: false, abaterDoPacote: false, extra: null, valorExtra: null };
    if (o.abatimento !== "abater" && o.abatimento !== "nao_abater") {
      return { ok: false, error: "Diga se esta devolutiva abate da sequência do pacote." };
    }
    return { ok: true, chargeable: false, abaterDoPacote: o.abatimento === "abater", extra: null, valorExtra: null };
  }

  return { ok: false, error: "Diga como esta devolutiva deve ser considerada." };
}
