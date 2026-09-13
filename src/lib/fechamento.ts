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

import { sessoesDoMes, type SessaoDoPacote } from "./pacoteMes";
import { cobra, usaPacote, type FormatoPagamento } from "./reajuste";
import { sequenciasFechadasNoMes } from "./sequenciaPacote";

export type PacienteDoFechamento = {
  id: string;
  nome: string;
  formato: FormatoPagamento | string | null | undefined;
  pacoteTipo?: "completo" | "fragmentado" | string | null;
  /** Dia combinado de pagamento, quando existe. Só para a tela mostrar. */
  diaPagamento?: number | null;
};

export type PagamentoDoMes = {
  pacienteId: string;
  /** Em reais. Vem do banco como texto, e chega aqui como número. */
  valor: number;
  data: Date | string;
  /** `paid` conta; `pending` e `overdue` não entraram ainda. */
  status: string;
};

export type PrecoVigente = {
  valor: number;
  /** A partir de quando aquele valor passou a valer. */
  desde: Date | string;
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
  valorDoMes: number;
  pago: number;
  /** Positivo = falta receber. Negativo = entrou mais do que o mês cobra. */
  saldo: number;
  situacao: SituacaoDoFechamento;
};

export type SituacaoDoFechamento = "sem_cobranca" | "a_receber" | "pago" | "pago_a_mais" | "sem_sessoes";

/** Um centavo de diferença não é dívida: é arredondamento. */
const TOLERANCIA = 0.005;

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/**
 * O preço que valia naquele mês.
 *
 * Pega a última faixa que começou até o FIM do mês fechado. Usar o preço de hoje para fechar um
 * mês antigo cobraria o reajuste retroativamente — e a conta pareceria certa na tela.
 */
export function precoNoMes(historico: PrecoVigente[], ano: number, mes: number): number {
  const fimDoMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const validos = historico
    .map((h) => ({ valor: Number(h.valor), desde: emData(h.desde) }))
    .filter((h) => Number.isFinite(h.valor) && !Number.isNaN(h.desde.getTime()))
    .filter((h) => h.desde.getTime() <= fimDoMes.getTime())
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());

  return validos.length > 0 ? validos[validos.length - 1].valor : 0;
}

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

function situacao(opts: { cobra: boolean; sessoes: number; valor: number; pago: number }): SituacaoDoFechamento {
  if (!opts.cobra) return "sem_cobranca";
  if (opts.sessoes === 0 && opts.valor === 0) return "sem_sessoes";
  const saldo = opts.valor - opts.pago;
  if (saldo > TOLERANCIA) return "a_receber";
  if (saldo < -TOLERANCIA) return "pago_a_mais";
  return "pago";
}

/**
 * A linha de um paciente no fechamento.
 *
 * Recebe as sessões dele (todas, de qualquer mês) e o histórico de preço dele; filtra pelo mês
 * pedido. Deixar o filtro aqui dentro evita que a tela esqueça de aplicá-lo em algum lugar.
 */
export function linhaDoFechamento(opts: {
  paciente: PacienteDoFechamento;
  sessoes: SessaoDoPacote[];
  precos: PrecoVigente[];
  pagamentos: PagamentoDoMes[];
  /** Os tamanhos contratados do paciente, na ordem. Só importa para quem fecha por pacote. */
  tamanhos?: number[];
  ano: number;
  mes: number;
}): LinhaDoFechamento {
  const { paciente, ano, mes } = opts;
  const naAgenda = sessoesDoMes(opts.sessoes, ano, mes);
  const argumentos = {
    formato: paciente.formato,
    pacoteTipo: paciente.pacoteTipo,
    sessoes: opts.sessoes,
    tamanhos: opts.tamanhos,
    ano,
    mes,
  };
  const cobradas = sessoesCobradas(argumentos);
  const pacotes = pacotesCobraveis(argumentos);
  const preco = precoNoMes(opts.precos, ano, mes);
  const valor = Number((cobradas * preco).toFixed(2));
  const pago = pagoNoMes(opts.pagamentos, paciente.id, ano, mes);

  return {
    pacienteId: paciente.id,
    nome: paciente.nome,
    formato: String(paciente.formato ?? "sessao"),
    sessoes: naAgenda,
    sessoesCobradas: cobradas,
    pacotesNoMes: pacotes.length,
    precoDaSessao: preco,
    valorDoMes: valor,
    pago,
    saldo: Number((valor - pago).toFixed(2)),
    situacao: situacao({ cobra: cobra(paciente.formato), sessoes: naAgenda, valor, pago }),
  };
}

export type ResumoDoFechamento = {
  aReceber: number;
  recebido: number;
  previsto: number;
  pacientesAReceber: number;
  /** Quem não teve sessão nenhuma no mês — some da conta, mas não da vista. */
  semSessoes: number;
};

/**
 * Os números do alto da tela.
 *
 * "Previsto" é o que o mês inteiro cobra; "recebido" é o que entrou; "a receber" é só o que falta
 * — e não a diferença entre os dois, porque quem pagou a mais não reduz a dívida de quem não pagou.
 */
export function resumoDoFechamento(linhas: LinhaDoFechamento[]): ResumoDoFechamento {
  const somar = (f: (l: LinhaDoFechamento) => number) =>
    Number(linhas.reduce((t, l) => t + f(l), 0).toFixed(2));

  return {
    previsto: somar((l) => l.valorDoMes),
    recebido: somar((l) => l.pago),
    aReceber: somar((l) => (l.saldo > TOLERANCIA ? l.saldo : 0)),
    pacientesAReceber: linhas.filter((l) => l.situacao === "a_receber").length,
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
