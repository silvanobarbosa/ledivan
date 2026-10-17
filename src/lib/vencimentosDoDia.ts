/**
 * VENCIMENTOS POR DIA (doc 44) — o que vence numa data, para cobrar.
 *
 * Função pura: recebe as cobranças já RESOLVIDAS (o server action tira do motor `geralDoPaciente`
 * as datas de sessão, o status e a contagem de avisos) e devolve as duas tabelas do painel —
 * sessões avulsas e pacotes — filtradas pela data escolhida. Fica separada da leitura do banco para
 * a regra de filtro/ordenação/mensagem poder ser conferida sem tocar em dado de verdade.
 */

export type SituacaoVenc = "pago" | "em_aberto" | "em_atraso";
export type TipoVencimentoPacote = "dia" | "primeira" | "ultima";

export type CobrancaResolvida = {
  cadastroId: string;
  nome: string;
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

/** Mensagem de cobrança de uma SESSÃO AVULSA (doc 44). */
export function mensagemAvulsa(c: { dataSessao?: string | null; valor: number }): string {
  return [
    "Olá! Espero que esteja bem!",
    "",
    `Passando para lembrar do pagamento referente à sessão de hoje (${dataBR(c.dataSessao)}), no valor de R$ ${reais(c.valor)}.`,
    "",
    "Peço, por gentileza, que me envie o comprovante assim que realizar o pagamento.",
    "",
    "Qualquer dúvida, estou à disposição!",
  ].join("\n");
}

/** Mensagem de cobrança de um PACOTE, conforme o tipo de vencimento (doc 44). */
export function mensagemPacote(c: {
  tipoVencimento?: TipoVencimentoPacote;
  vencimento?: string | null;
  primeiraSessao?: string | null;
  ultimaSessao?: string | null;
  valor: number;
}): string {
  const fim = "Peço, por gentileza, que me envie o comprovante assim que realizar o pagamento.\n\nQualquer dúvida, estou à disposição!";
  if (c.tipoVencimento === "primeira") {
    return `Olá! Espero que esteja bem!\n\nPassando para lembrar que hoje (${dataBR(c.primeiraSessao)}) inicia seu novo pacote, no valor de R$ ${reais(c.valor)}.\n\n${fim}`;
  }
  if (c.tipoVencimento === "ultima") {
    return `Olá! Espero que esteja bem!\n\nPassando para lembrar que hoje (${dataBR(c.ultimaSessao)}) finaliza seu pacote, no valor de R$ ${reais(c.valor)}.\n\n${fim}`;
  }
  // Dia específico (padrão).
  return `Olá! Espero que esteja bem!\n\nPassando para lembrar que, conforme combinado, o vencimento do seu pacote é hoje (${dataBR(c.vencimento)}), referente ao pacote com a data de início em (${dataBR(c.primeiraSessao)}), no valor de R$ ${reais(c.valor)}.\n\n${fim}`;
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
