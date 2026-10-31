/**
 * O QUE SE ESCOLHE AO MARCAR UM ATENDIMENTO.
 *
 * Doc 66 (dono, 31/10): a cortesia passa a ser decidida ao CRIAR o agendamento, e some da janela
 * de editar. O bloco aparece desde o primeiro agendamento, e muda de rótulo com o financeiro:
 *
 * | Financeiro | O que o bloco oferece |
 * | --- | --- |
 * | a cada sessão (avulso) | `Sessão Avulsa` · `Sessão Cortesia` |
 * | pacote, 1º agendamento | `Iniciar à sequência do pacote` · `Sessão Cortesia` |
 * | pacote, demais | `Adicionar à sequência do pacote` · `Não adicionar à sequência do pacote` · `Sessão Cortesia` |
 *
 * A primeira opção já vem marcada — marcar o atendimento sem olhar o bloco tem de produzir o que
 * sempre produziu.
 *
 * **Por que a cortesia não é a mesma coisa que "não adicionar à sequência":** a de fora da
 * sequência SAI do pacote (vira AVUL ou GRAT, independente, e o pacote segue sem ela); a cortesia
 * CONTINUA no pacote e no grupo de pagamento, só não ocupa posição nem gera cobrança (doc 54). A
 * sessão seguinte herda o número que seria dela. São dois destinos diferentes, e por isso são duas
 * opções, não uma.
 *
 * **O que fica de fora:** a devolutiva, que já tem as perguntas dela ("cobrar esta devolutiva" e
 * "abater do pacote") — duas decisões disputando a mesma tela; o financeiro que não cobra, onde
 * cortesia não diria nada que o formato já não diga; e a SÉRIE.
 *
 * A série não oferece cortesia porque cortesia é de UM atendimento. Marcar uma série inteira
 * dispensaria o pagamento de meses com um clique — foi por isso que o servidor do doc 54 já
 * recusava aplicá-la ao bloco em "este e os próximos". Oferecer o botão e depois não honrá-lo
 * seria pior do que não oferecer (SuperQA, 22/10), então ele não aparece.
 *
 * Função pura.
 */

import { cobra, usaPacote } from "./reajuste";

/** A escolha gravada. `normal` é o caminho de sempre. */
export type EscolhaDoAgendamento = "normal" | "fora" | "cortesia";

export type BlocoDoAgendamento = {
  /** O título do quadro, ou `null` quando o quadro não tem cabeçalho. */
  titulo: string | null;
  opcoes: { valor: EscolhaDoAgendamento; rotulo: string }[];
  padrao: EscolhaDoAgendamento;
};

export type ContextoDoAgendamento = {
  formato: string | null | undefined;
  sessionKind?: string | null;
  /** O paciente já tem outro agendamento — só então existe sequência para entrar ou não entrar. */
  jaTemSequencia?: boolean;
  /** É uma série (semanal, 2x ou quinzenal), e não um atendimento só. */
  emSerie?: boolean;
};

const CORTESIA = { valor: "cortesia" as const, rotulo: "Sessão Cortesia" };

export function blocoDoAgendamento(o: ContextoDoAgendamento): BlocoDoAgendamento | null {
  if (o.sessionKind === "devolutiva") return null;
  if (!cobra(o.formato)) return null;

  const cortesia = o.emSerie ? [] : [CORTESIA];

  if (!usaPacote(o.formato)) {
    // Sem cortesia, o avulso não teria o que perguntar: "Sessão Avulsa" sozinha é o que já acontece.
    if (!cortesia.length) return null;
    return { titulo: null, opcoes: [{ valor: "normal", rotulo: "Sessão Avulsa" }, ...cortesia], padrao: "normal" };
  }

  if (!o.jaTemSequencia) {
    if (!cortesia.length) return null;
    return { titulo: "Sequência do pacote", opcoes: [{ valor: "normal", rotulo: "Iniciar à sequência do pacote" }, ...cortesia], padrao: "normal" };
  }

  return {
    titulo: "Sequência do pacote",
    opcoes: [
      { valor: "normal", rotulo: "Adicionar à sequência do pacote" },
      { valor: "fora", rotulo: "Não adicionar à sequência do pacote" },
      ...cortesia,
    ],
    padrao: "normal",
  };
}

/**
 * A escolha que VALE, dado o bloco que está na tela.
 *
 * A escolha é um estado da janela e sobrevive a mudanças feitas depois dela: marcar "Sessão
 * Cortesia" e então trocar a repetição para semanal deixaria `cortesia` marcada num bloco que não
 * oferece mais essa opção — uma série de cortesias que ninguém pediu. Quem não está mais no bloco
 * volta para o padrão.
 */
export function escolhaEfetiva(bloco: BlocoDoAgendamento | null, escolha: EscolhaDoAgendamento): EscolhaDoAgendamento {
  if (!bloco) return "normal";
  return bloco.opcoes.some((o) => o.valor === escolha) ? escolha : bloco.padrao;
}

/**
 * O que a escolha vira no formulário.
 *
 * `naSequencia` continua sendo o campo que o servidor lê há tempo (`extraParaGravar`), e a
 * cortesia NÃO o usa: ela não sai do pacote. É o que mantém as duas decisões separadas no banco.
 */
export function camposDaEscolha(escolha: EscolhaDoAgendamento): { naSequencia: "sim" | "nao"; cortesia: boolean } {
  return { naSequencia: escolha === "fora" ? "nao" : "sim", cortesia: escolha === "cortesia" };
}
