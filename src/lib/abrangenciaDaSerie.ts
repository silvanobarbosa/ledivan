/**
 * "TODAS AS SESSÕES DESTA SEQUÊNCIA, OU APENAS ESTA?"
 *
 * Doc 73 (dono): marcar uma série inteira como gratuita, avulsa ou cortesia é um combinado
 * diferente de marcar só o primeiro atendimento dela — e até aqui o app decidia sozinho: a série
 * INTEIRA herdava a escolha, sem perguntar. Quem queria uma única sessão de cortesia dentro de um
 * ritmo semanal saía com o ritmo inteiro de graça.
 *
 * A pergunta só existe quando há série (repetir até) E quando a escolha muda o que a sessão é.
 * Agendamento único não tem "todas"; série normal não tem o que perguntar.
 *
 * Isto NÃO mexe em dinheiro lançado: decide com que marca cada sessão NASCE, na agenda. Cobrança
 * é consequência da sessão, como sempre foi.
 *
 * Funções puras.
 */

/** O que o quadro do agendamento devolveu. Ver `opcoesDoAgendamento.ts`. */
export type EscolhaDaSerie = "normal" | "fora" | "cortesia" | string;

export type Abrangencia = "todas" | "apenas_esta";

export type PerguntaDaAbrangencia = {
  /** A pergunta, com as palavras do dono. */
  titulo: string;
  /** O rótulo de cada resposta. */
  todas: string;
  apenasEsta: string;
};

/**
 * A pergunta a fazer ao salvar — `null` quando não há o que perguntar.
 *
 * `cobrada` é a resposta de "Esta sessão será cobrada?": `sim` = avulsa, `nao` = gratuita. Ela só
 * existe quando a escolha foi ficar FORA da sequência do pacote.
 */
export function perguntaDaAbrangencia(o: {
  recorrente: boolean;
  escolha: EscolhaDaSerie | null | undefined;
  cobrada?: string | null;
}): PerguntaDaAbrangencia | null {
  if (!o.recorrente) return null;

  if (o.escolha === "cortesia") {
    return {
      titulo: "Deseja tornar todas as sessões desta sequência cortesia ou apenas esta sessão?",
      todas: "Todas as sessões",
      apenasEsta: "Apenas esta sessão",
    };
  }

  if (o.escolha === "fora") {
    if (o.cobrada === "nao") {
      return {
        titulo: "Deseja tornar gratuitas todas as sessões desta sequência ou apenas esta sessão?",
        todas: "Todas gratuitas",
        apenasEsta: "Apenas esta",
      };
    }
    if (o.cobrada === "sim") {
      return {
        titulo: "Deseja que todas as sessões desta sequência sejam agendadas como avulsas ou apenas esta sessão?",
        todas: "Todas avulsas",
        apenasEsta: "Apenas esta",
      };
    }
  }

  return null;
}

/** Entrada estranha (ou ausente) é `todas` — que é o que o app sempre fez. */
export function abrangenciaValida(v: unknown): Abrangencia {
  return v === "apenas_esta" ? "apenas_esta" : "todas";
}

export type MarcasDaSessao = {
  extra: string | null;
  valorExtra: string | null;
  cortesia: boolean;
};

/**
 * AS MARCAS DE CADA SESSÃO DA SÉRIE.
 *
 * `todas` repete a escolha em todas — o comportamento de sempre. `apenas_esta` deixa a marca na
 * PRIMEIRA e devolve as outras ao ritmo normal: sem `extra` elas voltam a ocupar posição na
 * sequência do pacote ("o restante deve ser agendada iniciando/seguindo a sequência"), e sem
 * `cortesia` voltam a ser cobradas como qualquer atendimento daquele financeiro — que, em quem
 * paga a cada sessão, é exatamente a avulsa que o documento pede.
 */
export function marcasDaSessao(o: {
  indice: number;
  abrangencia: Abrangencia;
  escolhido: MarcasDaSessao;
}): MarcasDaSessao {
  if (o.abrangencia === "todas" || o.indice === 0) return o.escolhido;
  return { extra: null, valorExtra: null, cortesia: false };
}
