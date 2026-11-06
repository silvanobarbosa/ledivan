/**
 * AS MENSAGENS DE COBRANÇA — um lugar só para todas as redações (dono, docs 60 e 61).
 *
 * Elas nasceram personalizáveis por terapeuta (16/09/2026): cada uma escrevia um modelo com
 * variáveis e o sistema trocava pelos dados. O modelo continua existindo — quem escrever o seu,
 * manda nele —, mas os PADRÕES são os textos que o dono definiu, e valem para todas: o que uma
 * terapeuta pede de formato de cobrança é o formato de todas (regra da casa).
 *
 * O doc 60 unificou a frase; o doc 61 voltou a separá-la em QUATRO situações, porque o que se diz
 * a quem está começando um pacote não é o que se diz a quem já o terminou. O que não se repete é
 * a REDAÇÃO solta por tela: as quatro moram aqui, e quem cobra só informa o caso e os dados.
 *
 * Três coisas do texto não são enfeite e por isso moram aqui, e não em cada tela:
 *
 * - **As quebras de linha e as linhas em branco** ("respeitando quebra de linha e espaços em
 *   branco"). No WhatsApp um parágrafo por assunto é o que faz a mensagem ser lida.
 * - **Quais sessões a cobrança cobre** (`{sessoes}`). Quem recebe precisa conferir o que paga.
 * - **A linha que se apaga sozinha.** Sem saber as datas, a linha das sessões sai inteira: melhor
 *   não dizer do que dizer "Referente às sessões dos dias: .".
 *
 * **A data do vencimento vem SEMPRE do campo do Financeiro** (doc 61), nunca de uma data
 * recalculada na hora de escrever a mensagem. Esse campo é editável pelo lápis, e uma mensagem que
 * ignora a edição manda ao paciente uma data que a terapeuta já corrigiu na tela.
 *
 * Funções puras.
 */

/** As quatro situações de cobrança que têm redação própria (doc 61). */
export type CasoDaCobranca = "mensal" | "primeira" | "ultima" | "avulso";

export const VARIAVEIS_COBRANCA = ["{nome}", "{valor}", "{vencimento}", "{sessoes}", "{sessao}", "{horas}"] as const;

const FIM = [
  "",
  "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
  "",
  "Qualquer dúvida, estou à disposição!",
];

/** Mensal com pagamento no dia do vencimento (doc 60) — e o texto de quem já passou do prazo. */
export const MODELO_PADRAO_COBRANCA = [
  "Olá {nome}!",
  "",
  "Passando para lembrar do pagamento de {valor}, com vencimento em {vencimento}.",
  "",
  "Referente às sessões dos dias: {sessoes}.",
  ...FIM,
].join("\n");

/** Mensal que vence na PRIMEIRA sessão do pacote, com ela ainda por vir (doc 61). */
export const MODELO_PRIMEIRA_SESSAO = [
  "Olá {nome}!",
  "",
  "Passando para informar que estaremos iniciando um novo pacote de sessões.",
  "",
  "Conforme combinado, o pagamento deverá ser realizado até a primeira sessão, em {vencimento}.",
  "",
  "O pacote é referente às sessões dos dias: {sessoes}.",
  ...FIM,
].join("\n");

/** Mensal que vence na ÚLTIMA sessão do pacote, com ela ainda por vir (doc 61). */
export const MODELO_ULTIMA_SESSAO = [
  "Olá {nome}!",
  "",
  "Passando para informar que estamos finalizando o pacote de sessões.",
  "",
  "Conforme combinado, o pagamento deverá ser realizado no final deste pacote, em {vencimento}.",
  "",
  "O pacote é referente às sessões dos dias: {sessoes}.",
  ...FIM,
].join("\n");

/** Sessão avulsa, sem prazo combinado — paga-se até o momento da sessão (doc 61). */
export const MODELO_AVULSO = [
  "Olá {nome}!",
  "",
  "Passando para lembrar que você tem sessão hoje, {sessao}, e que o pagamento avulso, no valor de {valor}, ainda está pendente.",
  "",
  "Conforme combinado, o pagamento deverá ser realizado até o momento da sessão.",
  ...FIM,
].join("\n");

/** Sessão avulsa com "pagar até X horas antes" preenchido (doc 61) — o horário pode ser cedido. */
export const MODELO_AVULSO_PRAZO = [
  "Olá {nome}!",
  "",
  "Passando para lembrar que você tem sessão hoje, {sessao}, e que o pagamento avulso, no valor de {valor}, ainda está pendente.",
  "",
  "Lembrando que o pagamento deve ser realizado até às {horas} horas antes da sessão. Caso contrário, a sessão será considerada desmarcada, e o horário poderá ser cedido a outro paciente, caso haja procura. 😉",
  ...FIM,
].join("\n");

/** O dia (YYYY-MM-DD) de um ISO de hora de parede, sem passar por fuso. */
export const diaDoISO = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** `2026-11-09…` → `09/11/26` — o formato curto que a dona usa para listar sessão. */
export const dataCurtaBR = (iso: string | null | undefined): string => {
  const d = diaDoISO(iso);
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
  /** Qual das quatro redações. Sem informar, a mensal — que é a do doc 60. */
  caso?: CasoDaCobranca;
  /** Primeiro nome do paciente (ou responsável). Vazio tira o nome sem deixar buraco no "Olá!". */
  nome?: string | null;
  /** Já formatado, ex.: "R$ 520,00". */
  valor: string;
  /** O VENCIMENTO DO FINANCEIRO (ISO de parede) — o campo editável, não uma data recalculada. */
  vencimento?: string | null;
  /** As datas (ISO de parede) das sessões que esta cobrança cobre. Vazio apaga a linha delas. */
  sessoes?: string[] | null;
  /** Avulso: a data da sessão cobrada. */
  sessao?: string | null;
  /** Avulso: o "pagar até X horas antes" combinado no cadastro. Sem ele, a outra redação. */
  horasAntes?: number | null;
  /** YYYY-MM-DD. Primeira/última já passada cai no texto padrão (doc 61). Padrão: hoje. */
  hoje?: string | null;
};

const hojeISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Qual redação vale para esta cobrança (doc 61).
 *
 * Primeira e última sessão só ganham o texto próprio enquanto a data AINDA NÃO CHEGOU — passada
 * ela, "estaremos iniciando um novo pacote" vira mentira, e o que cabe é o lembrete padrão.
 */
export function modeloPadraoDa(dados: DadosDaCobranca): string {
  const hoje = dados.hoje ?? hojeISO();
  const venceu = (diaDoISO(dados.vencimento) ?? "9999-12-31") < hoje;
  if (dados.caso === "avulso") return dados.horasAntes ? MODELO_AVULSO_PRAZO : MODELO_AVULSO;
  if (venceu) return MODELO_PADRAO_COBRANCA;
  if (dados.caso === "primeira") return MODELO_PRIMEIRA_SESSAO;
  if (dados.caso === "ultima") return MODELO_ULTIMA_SESSAO;
  return MODELO_PADRAO_COBRANCA;
}

/** Troca as variáveis do modelo pelos dados. Modelo vazio cai no padrão do caso. */
export function montarMensagemCobranca(modelo: string | null | undefined, dados: DadosDaCobranca): string {
  const base = (modelo ?? "").trim() || modeloPadraoDa(dados);
  const primeiroNome = (dados.nome || "").trim().split(/\s+/)[0] || "";
  const sessoes = listaDeSessoes(dados.sessoes);
  const vencimento = diaDoISO(dados.vencimento) ? dataCurtaBR(dados.vencimento) : "a combinar";

  // Sem datas, a LINHA inteira sai — não só a variável. Ver o cabeçalho.
  const linhas = base.split("\n").filter((l) => sessoes || !l.includes("{sessoes}"));

  return linhas
    .join("\n")
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{valor}", dados.valor || "")
    .replaceAll("{vencimento}", vencimento)
    .replaceAll("{sessoes}", sessoes)
    .replaceAll("{sessao}", dataCurtaBR(dados.sessao))
    .replaceAll("{horas}", String(dados.horasAntes ?? ""))
    // Nome vazio não pode deixar espaço solto antes da pontuação ("Olá !"), e a linha removida
    // não pode deixar duas linhas em branco coladas.
    .replace(/[ \t]+([!,.;:?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
