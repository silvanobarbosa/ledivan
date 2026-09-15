/**
 * O FECHAMENTO DO MÊS: quanto cada paciente deve, e quanto já entrou.
 *
 * É o ritual do fim do mês, e por isso mora numa tela só dele — separado do dia a dia de
 * pagamentos. A pergunta que ele responde é uma: *fechando este mês, quem ainda deve, e quanto?*
 *
 * Três decisões que estruturam tudo:
 *
 * 1. **Quem conta as sessões é a AGENDA**, nunca um número digitado no cadastro. Setembro com
 *    três quartas cobra três sessões; outubro com quatro cobra quatro. Cancelada e realocada
 *    saem da conta — o paciente não paga por atendimento que não houve.
 * 2. **O preço é o que valia NAQUELE mês**, e não o de hoje. Fechar agosto com o preço reajustado
 *    em setembro é cobrar a mais, e ninguém percebe olhando a tela.
 * 3. **O pacote completo são quatro sessões, sempre.** É o combinado; se a agenda marcou três, o
 *    pacote continua custando quatro. Fragmentado é o contrário: custa o que a agenda tiver.
 *
 * Tudo aqui é função pura — recebe listas, devolve números. Quem busca no banco é a tela.
 */

import { ativasEmOrdem, sessoesDoMes, type SessaoDoPacote } from "./pacoteMes";
import { precoNaData, type PrecoVigente } from "./preco";
import { cobrancasDoPaciente, type Cobranca, type SessaoDaCobranca } from "./cobrancas";
import type { VigenciaDoFormato } from "./vigenciaDoFormato";
import { cobra, usaPacote, type FormatoPagamento } from "./reajuste";
import { sequenciasFechadasNoMes, todasAsSequencias } from "./sequenciaPacote";

export { precoNaData, precoNoMes, type PrecoVigente } from "./preco";

export type PacienteDoFechamento = {
  id: string;
  nome: string;
  formato: FormatoPagamento | string | null | undefined;
  pacoteTipo?: "completo" | "fragmentado" | string | null;
  /** Dia combinado de pagamento, quando existe. Só para a tela mostrar. */
  diaPagamento?: number | null;
  /**
   * O valor da sessão no cadastro, usado quando o histórico de preço não alcança a data.
   *
   * Sem esta reserva, paciente sem histórico cobrava ZERO — e some receita sem ninguém perceber,
   * que é o mesmo tipo de erro da dívida inventada, só que na direção contrária. Na demonstração
   * são 12 de 103.
   */
  valorDaSessao?: number | null;
};

export type PagamentoDoMes = {
  pacienteId: string;
  /** Em reais. Vem do banco como texto, e chega aqui como número. */
  valor: number;
  data: Date | string;
  /** `paid` conta; `pending` e `overdue` não entraram ainda. */
  status: string;
};


export type LinhaDoFechamento = {
  pacienteId: string;
  nome: string;
  formato: string;
  /** Quantas sessões a AGENDA contou naquele mês (fora canceladas e realocadas). */
  sessoes: number;
  /** Quantas sessões a conta cobra. Para quem fecha por pacote, é a soma das sequências. */
  sessoesCobradas: number;
  /** Quantos pacotes entraram na conta deste mês. Zero para quem paga a cada sessão. */
  pacotesNoMes: number;
  precoDaSessao: number;
  /** O que ESTE mês cobrou. Mesmo valor de `cobradoNoMes`; o nome antigo continua por compatibilidade. */
  valorDoMes: number;
  cobradoNoMes: number;
  pagoNoMes: number;
  /** Tudo que foi cobrado e tudo que foi pago até o fim daquele mês. */
  cobradoAcumulado: number;
  pagoAcumulado: number;
  /** O que entrou no mês. Mesmo valor de `pagoNoMes`. */
  pago: number;
  /**
   * A posição REAL: tudo que foi cobrado menos tudo que foi pago, até o fim daquele mês.
   *
   * Positivo = deve. Negativo = tem crédito. Não é a diferença do mês — um pagamento de setembro
   * quita corretamente um pacote de agosto.
   */
  saldo: number;
  situacao: SituacaoDoFechamento;
};

export type SituacaoDoFechamento = "sem_cobranca" | "a_receber" | "pago" | "pago_a_mais" | "sem_sessoes";

/** Um centavo de diferença não é dívida: é arredondamento. */
const TOLERANCIA = 0.005;

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));



/**
 * Quantas sessões o mês cobra — e a unidade da conta segue o CONTRATO, não o calendário.
 *
 * Era aqui que estava o erro mais fundo do motor: ele cobrava tudo por mês do calendário, mesmo de
 * quem não contratou por mês. Um paciente de pacote via a fatura de setembro ENCOLHER a cada
 * desmarcação, quando o que ele contratou foram quatro atendimentos e não o mês de setembro.
 *
 * Agora são três unidades diferentes, uma por tipo de combinado:
 *
 * - **Pacote** (mensal, quinzenal, primeira e última do pacote): cobra a SEQUÊNCIA, quando ela
 *   fecha. Uma sequência de setembro empurrada por um atestado fecha em outubro e cobra em
 *   outubro, inteira. Sequência pela metade não cobra — ninguém cobra pacote incompleto.
 * - **A cada sessão**: cobra cada sessão que ocupou posição naquele mês.
 * - **Gratuito**: não cobra nunca.
 *
 * Decisão do dono, 13/09/2026: cobrar por sequência em vez de por data.
 */
export function pacotesCobraveis(opts: {
  formato: FormatoPagamento | string | null | undefined;
  pacoteTipo: string | null | undefined;
  sessoes: SessaoDoPacote[];
  tamanhos?: number[];
  ano: number;
  mes: number;
}) {
  if (!cobra(opts.formato) || !usaPacote(opts.formato)) return [];
  const tipo = opts.pacoteTipo === "fragmentado" ? "fragmentado" : "completo";
  // Quem combinou pagar na PRIMEIRA do pacote vence na abertura; os demais, quando ela fecha.
  const momento = opts.formato === "primeira_pacote" ? "abertura" : "fechamento";
  return sequenciasFechadasNoMes(
    opts.sessoes,
    { pacoteTipo: tipo, tamanhos: opts.tamanhos },
    opts.ano,
    opts.mes,
    momento,
  );
}

export type EventoDeCobranca = {
  /** Quando a cobrança acontece: a data que decide em que mês ela cai. */
  data: Date;
  /** Quantas sessões aquele evento cobra. */
  sessoes: number;
};

/**
 * TUDO que aquele paciente deve, como eventos com data.
 *
 * É a peça que faltava. A tela antiga perguntava "quanto foi cobrado em agosto?" e "quanto foi
 * pago em agosto?", e comparava as duas — mas um pacote que fecha em 30/08 e é pago em 05/09 não
 * tem razão nenhuma para cair no mesmo mês. Medido na demonstração: 28 de 31 pacientes ativos
 * alternavam entre dever e ter pago a mais, e só 3 deviam de verdade.
 *
 * Com os eventos datados, a mesma lista responde as duas perguntas: filtrando pelo mês, o que
 * aconteceu ali; somando até o fim do mês, a posição real.
 */
export function eventosDeCobranca(opts: {
  formato: FormatoPagamento | string | null | undefined;
  pacoteTipo: string | null | undefined;
  sessoes: SessaoDoPacote[];
  tamanhos?: number[];
}): EventoDeCobranca[] {
  if (!cobra(opts.formato)) return [];

  if (usaPacote(opts.formato)) {
    const tipo = opts.pacoteTipo === "fragmentado" ? "fragmentado" : "completo";
    // Quem paga na PRIMEIRA do pacote vence na abertura; os demais, quando ela fecha.
    const naAbertura = opts.formato === "primeira_pacote";
    return todasAsSequencias(opts.sessoes, { pacoteTipo: tipo, tamanhos: opts.tamanhos })
      .map((seq) => ({ data: naAbertura ? seq.comecouEm : seq.fechouEm, total: seq.total }))
      .filter((x): x is { data: Date; total: number } => x.data instanceof Date)
      .map((x) => ({ data: x.data, sessoes: x.total }));
  }

  // A cada sessão: cada atendimento que ocupou posição é uma cobrança, no dia em que aconteceu.
  return ativasEmOrdem(opts.sessoes).map((x) => ({ data: x.data, sessoes: 1 }));
}

/** O quanto os eventos somam até o fim daquele mês, cada um pelo preço do seu dia. */
export function valorAte(eventos: EventoDeCobranca[], precos: PrecoVigente[], ano: number, mes: number, reserva = 0): number {
  const limite = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const total = eventos
    .filter((e) => e.data.getTime() <= limite.getTime())
    .reduce((soma, e) => soma + e.sessoes * precoNaData(precos, e.data, reserva), 0);
  return Number(total.toFixed(2));
}

/** O quanto os eventos somam DENTRO daquele mês. É o que a coluna do mês mostra. */
export function valorNoMes(eventos: EventoDeCobranca[], precos: PrecoVigente[], ano: number, mes: number, reserva = 0): number {
  const total = eventos
    .filter((e) => e.data.getFullYear() === ano && e.data.getMonth() === mes)
    .reduce((soma, e) => soma + e.sessoes * precoNaData(precos, e.data, reserva), 0);
  return Number(total.toFixed(2));
}

export function sessoesCobradas(opts: {
  formato: FormatoPagamento | string | null | undefined;
  pacoteTipo: string | null | undefined;
  /** Todas as sessões do paciente, de qualquer mês — a sequência não cabe num mês só. */
  sessoes: SessaoDoPacote[];
  /** Os tamanhos contratados, na ordem. Vazio cai no pacote de quatro. */
  tamanhos?: number[];
  ano: number;
  mes: number;
}): number {
  if (!cobra(opts.formato)) return 0;

  if (usaPacote(opts.formato)) {
    return pacotesCobraveis(opts).reduce((t, f) => t + f.total, 0);
  }

  // A cada sessão: conta o que aconteceu no mês, e sessão pausada não conta.
  return sessoesDoMes(opts.sessoes, opts.ano, opts.mes);
}

/** O que entrou no mês para aquele paciente. Só o que foi realmente pago. */
export function pagoNoMes(pagamentos: PagamentoDoMes[], pacienteId: string, ano: number, mes: number): number {
  const total = pagamentos
    .filter((p) => p.pacienteId === pacienteId && p.status === "paid")
    .map((p) => ({ valor: Number(p.valor), data: emData(p.data) }))
    .filter((p) => Number.isFinite(p.valor) && !Number.isNaN(p.data.getTime()))
    .filter((p) => p.data.getFullYear() === ano && p.data.getMonth() === mes)
    .reduce((soma, p) => soma + p.valor, 0);
  return Number(total.toFixed(2));
}

/** Tudo que o paciente pagou até o fim daquele mês. */
export function pagoAte(pagamentos: PagamentoDoMes[], pacienteId: string, ano: number, mes: number): number {
  const limite = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const total = pagamentos
    .filter((p) => p.pacienteId === pacienteId && p.status === "paid")
    .map((p) => ({ valor: Number(p.valor), data: emData(p.data) }))
    .filter((p) => Number.isFinite(p.valor) && !Number.isNaN(p.data.getTime()))
    .filter((p) => p.data.getTime() <= limite.getTime())
    .reduce((soma, p) => soma + p.valor, 0);
  return Number(total.toFixed(2));
}

function situacao(opts: { cobra: boolean; sessoes: number; valor: number; pago: number }): SituacaoDoFechamento {
  const saldo = opts.valor - opts.pago;
  // "Sem cobrança" só quando não há NADA a acertar. Antes bastava o formato de hoje ser gratuito, e
  // um paciente com R$ 800 de crédito aparecia como "sem cobrança" — o dinheiro sumia da leitura
  // sem sumir do banco.
  if (!opts.cobra && Math.abs(saldo) <= TOLERANCIA) return "sem_cobranca";
  if (opts.cobra && opts.sessoes === 0 && opts.valor === 0) return "sem_sessoes";
  if (saldo > TOLERANCIA) return "a_receber";
  if (saldo < -TOLERANCIA) return "pago_a_mais";
  return "pago";
}

const noMes = (d: Date | null, ano: number, mes: number) => !!d && d.getFullYear() === ano && d.getMonth() === mes;
const ate = (d: Date | null, limite: Date) => !!d && d.getTime() <= limite.getTime();
const soma = (cs: Cobranca[]) => Number(cs.reduce((t, c) => t + c.valor, 0).toFixed(2));

/**
 * A linha de um paciente no fechamento.
 *
 * A CONTA agora sai do motor único (`cobrancasDoPaciente`): a mesma lista que a guia Geral desenha
 * e que dá o rótulo da agenda. Aqui só se filtra pela competência — o dia que põe cada cobrança
 * num mês — e se soma.
 *
 * `vigencias` é o histórico de formato. Sem ele vale o formato do cadastro para a história inteira,
 * que era o comportamento antigo — e é por isso que a migração cria uma linha para cada paciente.
 */
export function linhaDoFechamento(opts: {
  paciente: PacienteDoFechamento;
  sessoes: SessaoDoPacote[] | SessaoDaCobranca[];
  precos: PrecoVigente[];
  pagamentos: PagamentoDoMes[];
  /** Os tamanhos contratados do paciente, na ordem. Só importa para quem fecha por pacote. */
  tamanhos?: number[];
  /** O histórico de formato do paciente. Vazio = vale o formato do cadastro para tudo. */
  vigencias?: VigenciaDoFormato[];
  ano: number;
  mes: number;
}): LinhaDoFechamento {
  const { paciente, ano, mes } = opts;
  const limite = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const reserva = Number(paciente.valorDaSessao) || 0;

  const cobrancas = cobrancasDoPaciente({
    vigencias: opts.vigencias ?? [],
    reserva: { formato: paciente.formato, pacoteTipo: paciente.pacoteTipo ?? null },
    sessoes: opts.sessoes as SessaoDaCobranca[],
    precos: opts.precos,
    valorDaSessao: reserva,
    tamanhos: opts.tamanhos,
    diaPagamento: paciente.diaPagamento ?? null,
  });

  const doMes = cobrancas.filter((c) => noMes(c.competencia, ano, mes));
  const acumuladas = cobrancas.filter((c) => ate(c.competencia, limite));
  // Um pacote quinzenal são duas cobranças, mas UM pacote fechado.
  const pacotes = new Set(doMes.filter((c) => c.tipo === "pacote" || c.tipo === "quinzena").map((c) => c.chave.replace(/:[12]$/, "")));
  const cobradas = doMes
    .filter((c) => c.tipo !== "quinzena" || c.parte === 1)
    .reduce((t, c) => t + c.sessoes, 0);

  const naAgenda = sessoesDoMes(opts.sessoes as SessaoDoPacote[], ano, mes);
  const cobradoNoMes = soma(doMes);
  const pagoNoMesAtual = pagoNoMes(opts.pagamentos, paciente.id, ano, mes);
  const cobradoAcumulado = soma(acumuladas);
  const pagoAcumulado = pagoAte(opts.pagamentos, paciente.id, ano, mes);
  const saldo = Number((cobradoAcumulado - pagoAcumulado).toFixed(2));
  // Cobra se o formato de ALGUM momento cobrou, ou se sobrou cobrança — não só o de hoje.
  const temCobranca = cobrancas.length > 0 || cobra(paciente.formato);

  return {
    pacienteId: paciente.id,
    nome: paciente.nome,
    formato: String(paciente.formato ?? "sessao"),
    sessoes: naAgenda,
    sessoesCobradas: cobradas,
    pacotesNoMes: pacotes.size,
    precoDaSessao: precoNaData(opts.precos, limite, reserva),
    valorDoMes: cobradoNoMes,
    cobradoNoMes,
    pagoNoMes: pagoNoMesAtual,
    cobradoAcumulado,
    pagoAcumulado,
    pago: pagoNoMesAtual,
    saldo,
    situacao: situacao({ cobra: temCobranca, sessoes: naAgenda, valor: cobradoAcumulado, pago: pagoAcumulado }),
  };
}

export type ResumoDoFechamento = {
  /** A dívida REAL: a soma dos saldos acumulados positivos. Não é uma conta do mês. */
  aReceber: number;
  /** O que entrou NESTE mês. */
  recebido: number;
  /** O que este mês cobrou. */
  previsto: number;
  pacientesAReceber: number;
  /** Quem tem crédito: pagou mais do que consumiu até aqui. */
  pacientesComCredito: number;
  /** Quem não teve sessão nenhuma no mês — some da conta, mas não da vista. */
  semSessoes: number;
};

/**
 * Os números do alto da tela.
 *
 * São três números de naturezas DIFERENTES, e é por isso que eles não fecham entre si:
 *
 * - **cobrado no mês** e **recebido no mês** são fotos daquele mês;
 * - **a receber** é a POSIÇÃO acumulada — tudo que foi cobrado até aqui menos tudo que foi pago.
 *
 * Esperar que "cobrado − recebido = a receber" seria voltar ao erro que esta tela tinha: um pacote
 * que fecha em agosto e é pago em setembro não tem razão nenhuma para cair no mesmo mês.
 *
 * "A receber" soma só os saldos positivos, porque quem pagou a mais não reduz a dívida de quem não
 * pagou — são duas pessoas diferentes.
 */
export function resumoDoFechamento(linhas: LinhaDoFechamento[]): ResumoDoFechamento {
  const somar = (f: (l: LinhaDoFechamento) => number) =>
    Number(linhas.reduce((t, l) => t + f(l), 0).toFixed(2));

  return {
    previsto: somar((l) => l.valorDoMes),
    recebido: somar((l) => l.pago),
    aReceber: somar((l) => (l.saldo > TOLERANCIA ? l.saldo : 0)),
    pacientesAReceber: linhas.filter((l) => l.situacao === "a_receber").length,
    pacientesComCredito: linhas.filter((l) => l.situacao === "pago_a_mais").length,
    semSessoes: linhas.filter((l) => l.situacao === "sem_sessoes").length,
  };
}

/**
 * A ordem da tela: quem deve primeiro, do maior saldo para o menor.
 *
 * Quem já está quitado desce, e quem não teve sessão vai para o fim — está na lista para a pessoa
 * conferir que não esqueceu ninguém, não para ser cobrado.
 */
export function ordemDoFechamento(linhas: LinhaDoFechamento[]): LinhaDoFechamento[] {
  const peso: Record<SituacaoDoFechamento, number> = {
    a_receber: 0,
    pago_a_mais: 1,
    pago: 2,
    sem_cobranca: 3,
    sem_sessoes: 4,
  };
  return [...linhas].sort((a, b) => {
    const p = peso[a.situacao] - peso[b.situacao];
    if (p !== 0) return p;
    if (b.saldo !== a.saldo) return b.saldo - a.saldo;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/** "agosto de 2026" — como a pessoa fala do mês que está fechando. */
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function mesPorExtenso(ano: number, mes: number): string {
  return `${MESES[mes] ?? "?"} de ${ano}`;
}

/** O mês anterior ao de hoje: é o que se fecha, e por isso é o que a tela abre. */
export function mesQueSeFecha(hoje: Date = new Date()): { ano: number; mes: number } {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}
