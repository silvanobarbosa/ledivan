/**
 * A mensagem de COBRANÇA — uma redação só, para todas as terapeutas (dono, doc 60).
 *
 * Ela nasceu personalizável por terapeuta (16/09/2026): cada uma escrevia um modelo com variáveis
 * e o sistema trocava pelos dados da cobrança. O modelo continua existindo — quem quiser escrever
 * o seu, escreve —, mas o PADRÃO passou a ser o texto do doc 60, e ele vale para todo mundo: o que
 * uma terapeuta pede de formato de cobrança é o formato de todas (regra da casa).
 *
 * Três coisas do texto não são enfeite e por isso moram aqui, e não em cada tela:
 *
 * - **As quebras de linha e as linhas em branco** ("respeitando quebra de linha e espaços em
 *   branco"). No WhatsApp um parágrafo por assunto é o que faz a mensagem ser lida.
 * - **Quais sessões a cobrança cobre** (`{sessoes}`). Quem recebe precisa conferir o que paga —
 *   é o mesmo motivo do doc 63, agora em todas as mensagens de vencimento e não só na do pacote.
 * - **A linha que se apaga sozinha.** Sem saber as datas, a linha das sessões sai inteira: melhor
 *   não dizer do que dizer "Referente às sessões dos dias: .".
 *
 * Função pura.
 */

export const VARIAVEIS_COBRANCA = ["{nome}", "{valor}", "{vencimento}", "{sessoes}"] as const;

export const MODELO_PADRAO_COBRANCA = [
  "Olá {nome}!",
  "",
  "Passando para lembrar do pagamento de {valor}, com vencimento em {vencimento}.",
  "",
  "Referente às sessões dos dias: {sessoes}.",
  "",
  "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
  "",
  "Qualquer dúvida, estou à disposição!",
].join("\n");

/** O dia (YYYY-MM-DD) de um ISO de hora de parede, sem passar por fuso. */
const diaDe = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** `2026-11-09…` → `09/11/26` — o formato curto que a dona usa para listar sessão. */
export const dataCurtaBR = (iso: string | null | undefined): string => {
  const d = diaDe(iso);
  if (!d) return "—";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a.slice(2)}`;
};

/**
 * "09/11/26, 16/11/26, 23/11/26 e 30/11/26" — as sessões que a cobrança cobre (doc 63).
 *
 * A dona cobrava um pacote dizendo só a data de INÍCIO dele, e quem recebia não conseguia conferir
 * o que estava pagando. Vazio quando não se sabe quais sessões são — e aí a linha some da mensagem.
 */
export function listaDeSessoes(datas: string[] | null | undefined): string {
  const curtas = (datas ?? []).map(dataCurtaBR).filter((d) => d !== "—");
  if (curtas.length === 0) return "";
  if (curtas.length === 1) return curtas[0];
  return `${curtas.slice(0, -1).join(", ")} e ${curtas[curtas.length - 1]}`;
}

export type DadosDaCobranca = {
  /** Primeiro nome do paciente (ou responsável). Vazio tira o nome sem deixar buraco no "Olá!". */
  nome?: string | null;
  /** Já formatado, ex.: "R$ 520,00". */
  valor: string;
  /** Já formatado, ex.: "05/10/26". Vazio quando não há data (cobrança sem vencimento). */
  vencimento?: string | null;
  /** As datas (hora de parede) das sessões que esta cobrança cobre. Vazio apaga a linha delas. */
  sessoes?: string[] | null;
};

/** Troca as variáveis do modelo pelos dados. Modelo vazio cai no padrão. */
export function montarMensagemCobranca(modelo: string | null | undefined, dados: DadosDaCobranca): string {
  const base = (modelo ?? "").trim() || MODELO_PADRAO_COBRANCA;
  const primeiroNome = (dados.nome || "").trim().split(/\s+/)[0] || "";
  const sessoes = listaDeSessoes(dados.sessoes);

  // Sem datas, a LINHA inteira sai — não só a variável. Ver o cabeçalho.
  const linhas = base.split("\n").filter((l) => sessoes || !l.includes("{sessoes}"));

  return linhas
    .join("\n")
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{valor}", dados.valor || "")
    .replaceAll("{vencimento}", (dados.vencimento || "").trim() || "a combinar")
    .replaceAll("{sessoes}", sessoes)
    // Nome vazio não pode deixar espaço solto antes da pontuação ("Olá !"), e a linha removida
    // não pode deixar duas linhas em branco coladas.
    .replace(/[ \t]+([!,.;:?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
