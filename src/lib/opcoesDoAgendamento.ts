/**
 * O QUE SE ESCOLHE AO MARCAR UM ATENDIMENTO.
 *
 * Um quadro só, e só para quem fecha por PACOTE:
 *
 * | Momento | O que o quadro oferece |
 * | --- | --- |
 * | 1º agendamento | `Iniciar à sequência do pacote` · `Não adicionar à sequência do pacote` |
 * | demais | `Adicionar à sequência do pacote` · `Não adicionar à sequência do pacote` |
 *
 * A diferença entre os dois é só o VERBO: no primeiro agendamento não há sequência para "adicionar
 * a", ela está sendo começada. O caminho gravado é o mesmo.
 *
 * "Não adicionar" segue abrindo a pergunta de sempre — a sessão será cobrada? `Sim (AVUL)` ou
 * `Não (GRAT)`.
 *
 * **Não há botão de cortesia aqui** (doc 67, dono): "já temos a opção GRAT no botão não adicionar
 * à sequência do pacote". Ele existiu entre o doc 66 e o doc 67 e foi retirado dos dois momentos.
 * A diferença que se perde é real e fica registrada: a de fora SAI do pacote; a cortesia
 * CONTINUARIA nele, sem ocupar posição. Para quem usa, a consequência em dinheiro é a mesma — não
 * cobra —, e duas portas para "não cobrar esta sessão" confundiam mais do que ajudavam.
 *
 * A primeira opção já vem marcada: marcar o atendimento sem olhar o quadro tem de produzir o que
 * sempre produziu. A devolutiva fica de fora, porque já tem as perguntas dela.
 *
 * Função pura.
 */

import { cobra, usaPacote } from "./reajuste";

/** A escolha gravada. `normal` é o caminho de sempre. */
export type EscolhaDoAgendamento = "normal" | "fora" | "cortesia";

export type BlocoDoAgendamento = {
  titulo: string;
  opcoes: { valor: EscolhaDoAgendamento; rotulo: string }[];
  padrao: EscolhaDoAgendamento;
};

export type ContextoDoAgendamento = {
  formato: string | null | undefined;
  sessionKind?: string | null;
  /** O paciente já tem outro agendamento — só então existe sequência para ADICIONAR a. */
  jaTemSequencia?: boolean;
};

const FORA = { valor: "fora" as const, rotulo: "Não adicionar à sequência do pacote" };

export function blocoDoAgendamento(o: ContextoDoAgendamento): BlocoDoAgendamento | null {
  if (o.sessionKind === "devolutiva") return null;
  if (!cobra(o.formato)) return null;

  /**
   * QUEM PAGA A CADA SESSÃO tem o quadro dele (doc 71, dono): "esta sessão será cortesia, sim ou
   * não". Sim lança GRAT na agenda e no financeiro; não segue como a avulsa de sempre.
   *
   * Aqui não há sequência de pacote para entrar ou não — e era por isso que o financeiro avulso
   * não via quadro nenhum, e com ele perdia a única porta para não cobrar um atendimento. A
   * consequência é a mesma do `Não (GRAT)` do pacote; o que muda é a pergunta, que neste
   * financeiro é direta.
   *
   * O padrão é "Não": marcar o atendimento sem olhar o quadro tem de produzir o que sempre produziu.
   */
  if (!usaPacote(o.formato)) {
    return {
      titulo: "Esta sessão será cortesia",
      opcoes: [
        { valor: "cortesia", rotulo: "Sim" },
        { valor: "normal", rotulo: "Não" },
      ],
      padrao: "normal",
    };
  }

  return {
    titulo: "Sequência do pacote",
    opcoes: [
      { valor: "normal", rotulo: o.jaTemSequencia ? "Adicionar à sequência do pacote" : "Iniciar à sequência do pacote" },
      FORA,
    ],
    padrao: "normal",
  };
}

/**
 * A escolha que VALE, dado o quadro que está na tela.
 *
 * A escolha é um estado da janela e sobrevive a mudanças feitas depois dela — trocar o paciente ou
 * o tipo pode apagar o quadro inteiro. Quem não está mais nele volta para o padrão.
 */
export function escolhaEfetiva(bloco: BlocoDoAgendamento | null, escolha: EscolhaDoAgendamento): EscolhaDoAgendamento {
  if (!bloco) return "normal";
  return bloco.opcoes.some((o) => o.valor === escolha) ? escolha : bloco.padrao;
}

/** O que a escolha vira no formulário. */
export function camposDaEscolha(escolha: EscolhaDoAgendamento): { naSequencia: "sim" | "nao"; cortesia: "sim" | "nao" } {
  return {
    naSequencia: escolha === "fora" ? "nao" : "sim",
    // A cortesia não tira a sessão da sequência: dentro do pacote ela PAUSA a numeração (doc 54),
    // e no financeiro a cada sessão simplesmente não gera cobrança. Quem decide isso é o motor.
    cortesia: escolha === "cortesia" ? "sim" : "nao",
  };
}
