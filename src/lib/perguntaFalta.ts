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
    titulo: "Deseja cobrar esta sessão?",
    explicaSim: "A sessão será lançada como Avulso.",
    explicaNao: "A sessão seguirá gratuita, sem cobrança.",
  },
  avulso: {
    // Doc 57: "Continuar cobrando" e não "Cobrar". A sessão JÁ é cobrada — a pergunta é se segue
    // sendo, e o verbo precisa dizer isso, senão "Não" parece não fazer nada.
    titulo: "Continuar cobrando esta sessão?",
    explicaSim: "A sessão continuará sendo lançada e cobrada como avulso.",
    explicaNao: "Esta sessão será convertida para gratuita, sem gerar cobrança.",
  },
  pacote: {
    titulo: "Abater esta sessão do pacote?",
    // Doc 55: o texto antigo falava em "abater" e "contagem", que é a palavra do sistema. Estes
    // dizem o que acontece com a NUMERAÇÃO — que é o que ela vê na célula e na tabela.
    explicaSim: "A sessão será contabilizada como utilizada no pacote, avançando a numeração das sessões.",
    explicaNao: "A sessão não será contabilizada como utilizada no pacote. A numeração das sessões seguintes será mantida, sem consumir uma sessão do pacote.",
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

/**
 * A pergunta é a do que a sessão É AGORA, não a do formato do cadastro (doc 57).
 *
 * "O sistema deverá verificar se o agendamento é GRAT ou AVUL e, dependendo do tipo, abrir a
 * respectiva janela." A diferença aparece justamente em quem já converteu uma vez: um paciente
 * gratuito cuja sessão virou AVUL ao responder "Sim" precisa, na segunda vez, da pergunta do
 * AVUL — "continuar cobrando?" —, não de novo a do gratuito. Pelo formato do cadastro ele seria
 * sempre gratuito, e a janela ofereceria converter o que já está convertido.
 *
 * O rótulo é o que a terapeuta vê na célula da agenda, então a janela passa a concordar com a
 * tela. `X/4`, `DEVOL 2/4` e afins continuam caindo no pacote; sem rótulo, vale o cadastro.
 */
export function tipoDaFaltaPeloRotulo(rotulo: string | null | undefined, formato: string | null | undefined): TipoDaFalta {
  const r = String(rotulo ?? "").trim().toUpperCase();
  if (r.startsWith("GRAT")) return "gratuito";
  if (r.startsWith("AVUL")) return "avulso";
  if (/\d+\s*\/\s*\d+/.test(r)) return "pacote";
  return tipoDaFalta(formato);
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
