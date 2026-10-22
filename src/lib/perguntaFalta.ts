/**
 * A pergunta que aparece quando o terapeuta marca "Faltou" (doc 52, item 02).
 *
 * Antes era uma só, genérica: "Considerar sessão realizada?". Ela obrigava o usuário a traduzir
 * sozinho o que "realizada" significa para o contrato daquele paciente — e as consequências são
 * diferentes em cada caso: no avulso o Sim gera cobrança, no pacote o Sim consome uma sessão da
 * sequência, e no gratuito não havia o que decidir.
 *
 * Agora a pergunta é a do tipo do agendamento. O que vai para o servidor continua sendo o MESMO
 * booleano de sempre (`faltouConta`) — só o texto muda. Isso é de propósito: trocar a pergunta é
 * mudança de interface; mudar o que ela faz com o dinheiro seria outra entrega, com outro risco.
 */

export type TipoDaFalta = "gratuito" | "avulso" | "pacote";

export type PerguntaDaFalta = {
  titulo: string;
  /** O que acontece ao responder Sim. */
  explicaSim: string;
  /** O que acontece ao responder Não. */
  explicaNao: string;
};

const PERGUNTAS: Record<TipoDaFalta, PerguntaDaFalta> = {
  gratuito: {
    titulo: "Transformar esta sessão em uma sessão paga?",
    explicaSim: "A sessão será lançada como Avulso, e o valor deverá ser preenchido na própria sessão.",
    explicaNao: "A sessão seguirá normalmente como gratuita, sem cobrança.",
  },
  avulso: {
    titulo: "Cobrar esta sessão?",
    explicaSim: "A sessão continuará sendo lançada e cobrada como Avulso.",
    explicaNao: "A sessão passará a ser identificada como Gratuita, e não será gerada nenhuma cobrança.",
  },
  pacote: {
    titulo: "Abater esta sessão do pacote?",
    explicaSim: "A sessão será abatida da sequência do pacote, atualizando a contagem de sessões utilizadas.",
    explicaNao: "A sessão não será abatida da sequência do pacote, mantendo a contagem inalterada.",
  },
};

/**
 * Classifica o agendamento pelo formato de pagamento do cadastro.
 *
 * O formato chega de lugares diferentes do app com grafias diferentes ("sessao", "avulso",
 * "mensal", "quinzenal", "gratuito"...). Qualquer formato de PACOTE — mensal ou quinzenal, completo
 * ou fracionado — cai em "pacote", porque é o que muda a pergunta: existe uma sequência a abater.
 */
export function tipoDaFalta(formato: string | null | undefined): TipoDaFalta {
  const f = String(formato ?? "").trim().toLowerCase();
  if (!f) return "avulso"; // sem formato definido, a sessão é avulsa — é o default do cadastro
  if (f.includes("grat")) return "gratuito";
  if (f.includes("mensal") || f.includes("quinzen") || f.includes("pacote")) return "pacote";
  return "avulso"; // "sessao", "avulso" e qualquer outro
}

export function perguntaDaFalta(tipo: TipoDaFalta): PerguntaDaFalta {
  return PERGUNTAS[tipo] ?? PERGUNTAS.avulso;
}

/**
 * Como DESFAZER a escolha (doc 54). A resposta parecia definitiva: a janela some e não volta, e
 * nada na tela dizia que remarcar "Faltou" a traz de novo. Quem errou o clique ficava procurando
 * um botão que não existe.
 *
 * Isto substitui a dica que ficava na linha da guia Geral, embaixo da sessão. Ela dizia a mesma
 * coisa, mas no lugar onde a dúvida JÁ tinha virado problema — a hora de avisar é na escolha.
 */
export const COMO_REFAZER = 'Se mudar de ideia, selecione novamente "Faltou" para refazer sua escolha.';
