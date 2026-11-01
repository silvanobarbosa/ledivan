/**
 * O QUE A TERAPEUTA PEDIU, QUANDO ELA PEDE UMA AÇÃO.
 *
 * Até aqui o Divã só NAVEGAVA: a fala virava uma tarefa da lista fechada e ele abria a tela. Agora
 * ela pode mandar ele AGIR — anotar no paciente, reservar um horário, cancelar um atendimento —, e
 * isso muda o que está em jogo. Navegar errado custa um clique; anotar na paciente errada suja um
 * prontuário, e cancelar a sessão errada desmarca alguém de verdade.
 *
 * Por isso a divisão de trabalho fica ainda mais estrita:
 *
 *   o modelo OUVE   → só transcreve, e nada mais;
 *   o app DECIDE    → tudo daqui para baixo é determinístico e testável;
 *   ela CONFIRMA    → nenhuma escrita acontece sem ela ver o que foi entendido.
 *
 * Este arquivo faz a primeira metade do "decide": recorta a frase em VERBO, ALVO e TEXTO. Quem
 * resolve o alvo num paciente de verdade é `pacienteDaFala`; quem lê a data é `quandoDaFala`.
 *
 * Funções puras.
 */

/** As ações que a voz pode pedir. Lista fechada, como o catálogo de navegação. */
export type AcaoDaFala = "anotar" | "reservar" | "cancelar" | "pagar";

export type ComandoDaFala = {
  acao: AcaoDaFala;
  /** O que ela disse como sendo o paciente — ainda não resolvido. */
  alvo: string;
  /** O resto da frase: o conteúdo da anotação, ou a data do agendamento. */
  resto: string;
};

export function normalizar(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Os verbos de cada ação, do jeito que se fala.
 *
 * Em ordem de especificidade: o mais longo é testado primeiro, senão "marcar" rouba
 * "desmarcar" — e trocar reservar por cancelar é o pior erro que esta lista pode cometer.
 */
const VERBOS: { acao: AcaoDaFala; ditos: string[] }[] = [
  {
    acao: "cancelar",
    ditos: ["cancelar o atendimento de", "cancelar a sessao de", "cancelar a sessao da", "cancelar o atendimento da",
            "desmarcar a sessao de", "desmarcar a sessao da", "desmarcar o atendimento de", "desmarcar o atendimento da",
            "cancelar a consulta de", "cancelar a consulta da", "cancelar a", "cancelar o", "cancela a", "cancela o",
            "desmarcar a", "desmarcar o", "desmarca a", "desmarca o", "cancelar", "desmarcar", "cancela", "desmarca"],
  },
  {
    acao: "anotar",
    ditos: ["anotar no prontuario da", "anotar no prontuario do", "anotar no prontuario de",
            "anotar na ficha da", "anotar na ficha do", "registrar na", "registrar no", "registra na", "registra no",
            "anotar na", "anotar no", "anotar para a", "anotar para o", "anota na", "anota no", "anota para a",
            "anotacao na", "anotacao no", "anotar", "anota"],
  },
  {
    /**
     * PAGAR não grava dinheiro: abre o lançamento preenchido e ela aperta (ver `diva-actions`).
     *
     * Os ditos são longos de propósito. "registrar na Marcela" é anotação e "registrar o pagamento
     * da Marcela" é dinheiro — as duas começam igual, e quem separa é o dito mais longo vencer.
     */
    acao: "pagar",
    ditos: ["dar entrada em um pagamento para a", "dar entrada em um pagamento para o",
            "dar entrada em um pagamento da", "dar entrada em um pagamento do", "dar entrada em um pagamento de",
            "dar entrada no pagamento da", "dar entrada no pagamento do", "dar entrada no pagamento de",
            "dar entrada em um pagamento", "dar entrada no pagamento", "dar entrada",
            "registrar o pagamento da", "registrar o pagamento do", "registrar o pagamento de",
            "registrar um pagamento da", "registrar um pagamento do", "registrar pagamento da",
            "registrar pagamento do", "registrar pagamento de", "registrar um pagamento", "registrar pagamento",
            "lancar um pagamento para a", "lancar um pagamento para o", "lancar um pagamento da",
            "lancar um pagamento do", "lancar um pagamento de", "lancar o pagamento da", "lancar o pagamento do",
            "lancar o pagamento de", "lancar pagamento da", "lancar pagamento do", "lancar pagamento de",
            "lancar pagamento para a", "lancar um pagamento", "lancar o pagamento", "lancar pagamento",
            "lanca um pagamento da", "lanca o pagamento da", "lanca um pagamento", "lanca o pagamento", "lanca pagamento",
            "dar baixa no pagamento da", "dar baixa no pagamento do", "dar baixa no pagamento",
            "dar baixa na", "dar baixa no", "dar baixa",
            "recebi da", "recebi do", "recebi de", "receber da", "receber do", "receber de", "recebi"],
  },
  {
    acao: "reservar",
    ditos: ["reservar horario para a", "reservar horario para o", "reservar um horario para a",
            "marcar um atendimento para a", "marcar um atendimento para o", "marcar atendimento para a",
            "agendar a", "agendar o", "agendar para a", "agendar para o", "agenda a", "agenda o",
            "marcar a", "marcar o", "marcar para a", "marcar para o", "marca a", "marca o",
            "reservar para a", "reservar para o", "reservar a", "reservar o",
            "agendar", "marcar", "reservar", "agenda", "marca"],
  },
];

/**
 * Recorta a fala. `null` quando nenhum verbo de ação aparece — aí o Divã volta a tratar a frase
 * como navegação, e, não entendendo nem isso, pergunta.
 *
 * O verbo tem de abrir a frase (ou vir logo no começo). "Quem está devendo?" não é um pedido para
 * cancelar nada, e uma busca solta por "cancela" no meio de qualquer frase acharia fantasma.
 */
export function comandoDaFala(fala: string): ComandoDaFala | null {
  const texto = normalizar(fala).replace(/[?!.,;]+$/g, "");
  if (!texto) return null;

  // Tira os enfeites do começo: "por favor", "eu quero", "preciso", "pode"…
  const semEnfeite = texto.replace(
    /^(por favor,?\s+|eu\s+|voce pode\s+|pode\s+|quero\s+|queria\s+|preciso\s+|gostaria de\s+|vamos\s+)+/g,
    "",
  );

  let melhor: { acao: AcaoDaFala; tamanho: number; resto: string } | null = null;
  for (const { acao, ditos } of VERBOS) {
    for (const dito of ditos) {
      const alvo = normalizar(dito);
      if (!semEnfeite.startsWith(`${alvo} `) && semEnfeite !== alvo) continue;
      if (melhor && alvo.length <= melhor.tamanho) continue;
      melhor = { acao, tamanho: alvo.length, resto: semEnfeite.slice(alvo.length).trim() };
    }
  }
  /**
   * "A TALITA PAGOU 300" — o único lugar em que o verbo não abre a frase.
   *
   * É como se fala de dinheiro recebido, e exigir "lança o pagamento da Talita" obrigaria a
   * terapeuta a falar como o menu se chama. O padrão é estreito de propósito — nome seguido de
   * "pagou" — e não abre a porta para procurar verbo solto no meio de qualquer frase.
   */
  if (!melhor) {
    const pagou = semEnfeite.match(/^(?:a|o)\s+(.+?)\s+pagou\s+(.+)$/) ?? semEnfeite.match(/^(.+?)\s+pagou\s+(.+)$/);
    if (pagou) {
      const tudo = `${pagou[1]} ${pagou[2]}`.trim();
      return { acao: "pagar", alvo: tudo, resto: tudo };
    }
    return null;
  }

  /**
   * Onde o ALVO termina e o resto começa.
   *
   * O separador natural da fala é a pausa depois do nome — e a transcrição a escreve como PONTO
   * FINAL, não como dois-pontos. Falando "anota na Marcela: dormiu melhor", o Whisper devolve
   * "Anota na Marcela. Dormiu melhor" (medido em 31/10). Ler só os dois-pontos deixava toda
   * anotação ditada sem conteúdo.
   *
   * Sem separador nenhum não há como saber onde o nome acaba — então a anotação fica sem conteúdo
   * e a tela pede. Chutar o corte gravaria meio nome dentro do texto.
   */
  if (melhor.acao === "anotar") {
    const corte = melhor.resto.match(/^(.*?)(?:\s*[:.]\s+|\s+que\s+|\s+o seguinte\s+)(.+)$/);
    if (corte) return { acao: "anotar", alvo: corte[1].trim(), resto: corte[2].trim() };
    return { acao: "anotar", alvo: melhor.resto.replace(/[.:]+$/, "").trim(), resto: "" };
  }

  return { acao: melhor.acao, alvo: melhor.resto, resto: melhor.resto };
}
