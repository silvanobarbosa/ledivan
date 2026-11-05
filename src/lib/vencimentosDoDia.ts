/**
 * VENCIMENTOS POR DIA (doc 44) — o que vence numa data, para cobrar.
 *
 * Função pura: recebe as cobranças já RESOLVIDAS (o server action tira do motor `geralDoPaciente`
 * as datas de sessão, o status e a contagem de avisos) e devolve as duas tabelas do painel —
 * sessões avulsas e pacotes — filtradas pela data escolhida. Fica separada da leitura do banco para
 * a regra de filtro/ordenação/mensagem poder ser conferida sem tocar em dado de verdade.
 */

import { type RecebidoResumo } from "./recebidoPorForma";
import { dataCurtaBR, montarMensagemCobranca } from "./mensagemCobranca";

export type SituacaoVenc = "pago" | "em_aberto" | "em_atraso";
export type TipoVencimentoPacote = "dia" | "primeira" | "ultima";

export type CobrancaResolvida = {
  cadastroId: string;
  nome: string;
  /** Doc 46: número do cadastro (#0020) — é o "ID do cadastro" clicável no Menu Pagamentos. */
  registro?: number | null;
  /** Doc 50: id do cadastro (agenda) — vira o conteúdo da coluna "Nome" do Menu Pagamentos. */
  agendaId?: string | null;
  /** Doc 50: o recebido desta cobrança por forma de pagamento, com bruto e líquido (soma pelo líquido). */
  recebido?: RecebidoResumo;
  /**
   * Os lançamentos que FORMAM esse recebido, um a um (Prints 16).
   *
   * O resumo por forma soma e perde o pagamento individual — e, sem ele, uma lixeira no extrato
   * não tem alvo: a linha agregada não sabe dizer qual dos pagamentos sairia. É a mesma lista
   * que alimenta `recebidoPorForma`, então nenhuma conta muda por existir aqui.
   */
  lancamentos?: { id: string; valor: number; metodo: string | null; data: string }[];
  /** Telefone do responsável financeiro ou, na falta, da própria pessoa. */
  telefone: string | null;
  chave: string;
  grupo: "avulsa" | "pacote";
  /** Vencimento desta cobrança (ISO, hora de parede). Só entra no painel quando há vencimento. */
  vencimento: string | null;
  situacao: SituacaoVenc;
  valor: number;
  falta: number;
  enviosTotal: number;
  /** Doc 45: último pagamento (quando quitado) → mostra "Pago em [data]" e esconde o Cobrar. */
  pagoEm?: string | null;
  // Avulsa
  dataSessao?: string | null;
  /** Status da sessão avulsa (realizada | nao_realizada | …) — escolhe a mensagem de atraso. */
  statusSessao?: string | null;
  /** Momento a partir do qual fica em atraso (= o vencimento da avulsa). */
  horarioAtraso?: string | null;
  // Pacote
  tipoVencimento?: TipoVencimentoPacote;
  primeiraSessao?: string | null;
  ultimaSessao?: string | null;
  /** Doc 48: data da última sessão realizada – sequência (realizadas/total) – status DA SESSÃO. */
  ultimaRealizada?: { data: string; status: string; seq: string } | null;
  /** Doc 63: os dias das sessões que este pacote cobre, em ordem — vão na mensagem de cobrança. */
  datasDasSessoes?: string[] | null;
};

/** O dia (YYYY-MM-DD) de um ISO de hora de parede, sem passar por fuso. */
export function diaDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** As cobranças que vencem no dia escolhido, separadas em avulsas e pacotes. */
export function vencimentosNoDia(todas: CobrancaResolvida[], diaISO: string): {
  avulsas: CobrancaResolvida[];
  pacotes: CobrancaResolvida[];
} {
  const noDia = todas.filter((c) => c.vencimento && diaDe(c.vencimento) === diaISO);
  const avulsas = noDia
    .filter((c) => c.grupo === "avulsa")
    // Ordenar pelo horário de atraso, do menor para o maior (a 1ª cobrança a atrasar primeiro).
    .sort((a, b) => (a.horarioAtraso ?? a.vencimento ?? "").localeCompare(b.horarioAtraso ?? b.vencimento ?? ""));
  const pacotes = noDia
    .filter((c) => c.grupo === "pacote")
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { avulsas, pacotes };
}

const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (iso: string | null | undefined): string => {
  const d = diaDe(iso);
  return d ? d.split("-").reverse().join("/") : "—";
};

/** Mensagem de cobrança de uma SESSÃO AVULSA no vencimento (doc 44, redação do doc 60). */
export function mensagemAvulsa(c: { nome?: string | null; dataSessao?: string | null; vencimento?: string | null; valor: number }): string {
  return montarMensagemCobranca(null, {
    nome: c.nome,
    valor: `R$ ${reais(c.valor)}`,
    vencimento: curta(c.vencimento ?? c.dataSessao),
    sessoes: c.dataSessao ? [c.dataSessao] : [],
  });
}

/**
 * A data, no formato curto da mensagem — ou nada, para o texto dizer "a combinar".
 *
 * `dataCurtaBR` devolve um travessão quando não há data, e travessão dentro de "com vencimento em"
 * é pior do que a falta da data: parece defeito.
 */
const curta = (iso: string | null | undefined): string | null => (diaDe(iso) ? dataCurtaBR(iso) : null);

/**
 * Mensagem de cobrança de um PACOTE no vencimento (doc 44, redação do doc 60).
 *
 * O texto é o padrão da casa, montado em `mensagemCobranca` — avulsa e pacote dizem as MESMAS
 * palavras. O que muda entre eles é de onde sai o vencimento e quais sessões entram na lista, e
 * isso é dado, não redação. Três textos diferentes para a mesma frase era o jeito de um deles
 * ficar para trás quando a dona pedisse a próxima mudança.
 *
 * O vencimento do pacote tem três origens possíveis (doc 44: dia fixo, primeira ou última sessão);
 * a mensagem só precisa saber qual delas vale.
 */
export function mensagemPacote(c: {
  nome?: string | null;
  tipoVencimento?: TipoVencimentoPacote;
  vencimento?: string | null;
  primeiraSessao?: string | null;
  ultimaSessao?: string | null;
  datasDasSessoes?: string[] | null;
  valor: number;
}): string {
  const venc =
    c.tipoVencimento === "primeira" ? c.primeiraSessao
    : c.tipoVencimento === "ultima" ? c.ultimaSessao
    : c.vencimento;
  return montarMensagemCobranca(null, {
    nome: c.nome,
    valor: `R$ ${reais(c.valor)}`,
    vencimento: curta(venc),
    sessoes: c.datasDasSessoes ?? [],
  });
}

const fimAtraso = "Peço, por gentileza, que, assim que realizar o pagamento, me envie o comprovante.\n\nSe tiver alguma dúvida, estou à disposição!";

/** Mensagem de um PACOTE em atraso (doc 45, 6.1) — valor em aberto = saldo. */
export function mensagemPacoteAtraso(c: { vencimento?: string | null; falta: number }): string {
  return `Olá! Espero que esteja bem!\n\nPassando para lembrar que o vencimento do seu pacote foi no dia ${dataBR(c.vencimento)} e que o pagamento, no valor de R$ ${reais(c.falta)}, ainda consta em aberto.\n\n${fimAtraso}`;
}

/** Mensagem de uma SESSÃO AVULSA em atraso (doc 45, 6.2 Presente / 6.3 Faltou). */
export function mensagemAvulsaAtraso(c: { dataSessao?: string | null; vencimento?: string | null; falta: number; statusSessao?: string | null }): string {
  if (c.statusSessao === "nao_realizada") {
    return `Olá! Espero que esteja bem!\n\nPassando para lembrar que o pagamento referente à sessão agendada para o dia ${dataBR(c.dataSessao)}, na qual não houve comparecimento, venceu no dia ${dataBR(c.vencimento)} e ainda consta em aberto no valor de R$ ${reais(c.falta)}.\n\n${fimAtraso}`;
  }
  return `Olá! Espero que esteja bem!\n\nPassando para lembrar que o pagamento referente à sua sessão, realizada no dia ${dataBR(c.dataSessao)}, venceu no dia ${dataBR(c.vencimento)} e ainda consta em aberto no valor de R$ ${reais(c.falta)}.\n\n${fimAtraso}`;
}

/** A mensagem certa para a cobrança, conforme grupo e situação (doc 44/45). */
export function mensagemDeCobranca(c: CobrancaResolvida): string {
  const atraso = c.situacao === "em_atraso";
  if (c.grupo === "pacote") return atraso ? mensagemPacoteAtraso(c) : mensagemPacote(c);
  return atraso ? mensagemAvulsaAtraso(c) : mensagemAvulsa(c);
}
