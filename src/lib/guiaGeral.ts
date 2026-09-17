/**
 * A GUIA GERAL DO PACIENTE — linha a linha, sessões e pagamentos na ordem em que acontecem.
 *
 * Especificação do dono (15/09/2026). O que cada formato desenha:
 *
 * - **A cada sessão**: o valor fica na linha da própria sessão.
 * - **Gratuito**: GRAT, sem cobrança.
 * - **Mensal / primeira do pacote**: uma linha de pagamento ANTES da 1/X, no valor sessão × tamanho.
 * - **Quinzenal**: duas linhas de pagamento (metade cada) antes da sequência.
 * - **Última do pacote**: a linha de pagamento vem DEPOIS da última sessão.
 * - **AVUL / GRAT extras**: linha própria, sem mexer na sequência.
 *
 * Situação: a primeira cobrança fica em aberto até ser paga; as demais ficam "a vencer" até o dia
 * do vencimento e "em aberto" a partir dele, até o pagamento ser lançado.
 *
 * Nada aqui calcula cobrança: isso é do motor único (`cobrancas.ts`). Este arquivo só DISPÕE as
 * cobranças entre as sessões e casa os pagamentos com elas.
 *
 * Casamento: pagamento com `cobrancaChave` vai para a sua cobrança; o que não tem chave (os
 * lançados antes da guia existir, ou pela tela antiga) quita pela ordem de vencimento.
 *
 * Função pura.
 */

import { cobrancasDoPaciente, rotulosDasSessoes, type Cobranca, type EntradaDasCobrancas, type SessaoDaCobranca } from "./cobrancas";
import { formatoNaData } from "./vigenciaDoFormato";
import { STATUS_QUE_PAUSAM } from "./therapy";

export type PagamentoDaGeral = {
  id: string;
  valor: number | string;
  data: Date | string;
  status: string;
  metodo: string | null;
  pagoPor: string | null;
  cobrancaChave: string | null;
  /** `pacote` = crédito de pacote (não emite recibo). */
  kind?: string | null;
  /** Documento já emitido para este pagamento (17/09). Só o fato interessa aqui, não a hora. */
  recibo?: boolean;
  nota?: boolean;
};

/** O fato de uma cobrança ter sido avisada ao paciente. Uma por `cobrancaChave`. */
export type EnvioDaGeral = {
  cobrancaChave: string;
  enviadaEm: Date | string;
  enviadaPor?: string | null;
};

export type EntradaDaGeral = Omit<EntradaDasCobrancas, "sessoes"> & {
  sessoes: (SessaoDaCobranca & { online?: boolean | null })[];
  pagamentos: PagamentoDaGeral[];
  envios?: EnvioDaGeral[];
  /** "A cada sessão": horas ANTES da sessão em que o pagamento vence. Null/0 = vence na hora da sessão. */
  horasAntesPagamento?: number | null;
  hoje: Date;
};

/**
 * A situação de uma cobrança (dono, 16/09/2026):
 * - `em_aberto`: ainda dentro do prazo (não venceu).
 * - `em_atraso`: passou do vencimento sem o pagamento registrado.
 * - `pago`: registrado.
 *
 * O vencimento depende do formato: mensal/quinzenal/pacote vencem no DIA (vale o dia inteiro); "a
 * cada sessão"/avulsa vencem `horasAntesPagamento` antes da sessão (o prazo do avulso).
 */
export type Situacao = "pago" | "em_aberto" | "em_atraso";

export type PagamentoLancado = {
  id: string;
  data: Date;
  metodo: string | null;
  pagoPor: string | null;
  /** Marcas de "pago — emitido recibo / emitido nota" que a tela pinta ao lado de Pago. */
  recibo: boolean;
  nota: boolean;
};

/** Marca de "avisada ao paciente" que a tela pinta ao lado da cobrança. */
/**
 * Os avisos de cobranca daquela linha.
 *
 * `data` e o ULTIMO aviso — e o que a tela mostra. `datas` traz todos, do mais recente para o mais
 * antigo: o documento de 17/09 pede o historico completo, "sem substituir os registros anteriores",
 * porque quem cobrou tres vezes precisa ver as tres datas para saber se esta sendo ignorado.
 */
export type EnvioLancado = { data: Date; por: string | null; total: number; datas: Date[] };

export type CobrancaDaGeral = Cobranca & {
  situacao: Situacao;
  /** O que ainda falta receber — é o valor que "Lançar pagamento" grava. */
  falta: number;
  pagamento: PagamentoLancado | null;
  /** Preenchido quando a cobrança já foi avisada ao paciente. */
  envio: EnvioLancado | null;
};

export type LinhaDaGeral =
  | {
      tipo: "sessao";
      id: string;
      data: Date;
      online: boolean;
      status: string;
      rotulo: string;
      /** Valor que a linha mostra. `null` = a sessão é paga pela linha do pacote. */
      valor: number | null;
      /** A cobrança da própria linha (a cada sessão, AVUL). */
      cobranca: CobrancaDaGeral | null;
    }
  | ({ tipo: "pagamento"; tipoDeCobranca: Cobranca["tipo"] } & Omit<CobrancaDaGeral, "tipo">);

const TOLERANCIA = 0.005;
const emData = (d: Date | string) => (d instanceof Date ? d : new Date(d));

/** Mapa chave → avisos daquela cobranca: o ultimo em destaque, todos no historico. */
function mapaDeEnvios(envios: EnvioDaGeral[]): Map<string, EnvioLancado> {
  const porChave = new Map<string, { data: Date; por: string | null }[]>();
  for (const e of envios) {
    const data = emData(e.enviadaEm);
    if (Number.isNaN(data.getTime())) continue;
    const lista = porChave.get(e.cobrancaChave);
    const item = { data, por: e.enviadaPor ?? null };
    if (lista) lista.push(item);
    else porChave.set(e.cobrancaChave, [item]);
  }

  const m = new Map<string, EnvioLancado>();
  for (const [chave, lista] of porChave) {
    // Do mais recente para o mais antigo: e a ordem em que a pessoa le "avisei quando?".
    lista.sort((a, b) => b.data.getTime() - a.data.getTime());
    m.set(chave, { data: lista[0].data, por: lista[0].por, total: lista.length, datas: lista.map((x) => x.data) });
  }
  return m;
}

/**
 * O instante em que a cobrança vence.
 * - Avulsa ("a cada sessão"/extra): `horasAntes` antes da sessão — é o prazo do avulso.
 * - Demais (mensal/quinzenal/pacote): o FIM do dia do vencimento (vale o dia inteiro).
 */
function limiteDaCobranca(c: Cobranca, horasAntes: number): Date | null {
  const venc = c.vencimento ?? c.competencia;
  if (!venc) return null;
  if (c.tipo === "sessao" || c.tipo === "extra") {
    return new Date(venc.getTime() - Math.max(0, horasAntes) * 3600000);
  }
  return new Date(venc.getFullYear(), venc.getMonth(), venc.getDate(), 23, 59, 59, 999);
}

function casarPagamentos(cobrancas: Cobranca[], pagamentos: PagamentoDaGeral[], hoje: Date, envios: EnvioDaGeral[] = [], horasAntes = 0): CobrancaDaGeral[] {
  const enviosPorChave = mapaDeEnvios(envios);
  const pagos = pagamentos
    .filter((p) => p.status === "paid")
    .map((p) => ({ ...p, valor: Number(p.valor) || 0, data: emData(p.data) }))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));

  const chaves = new Set(cobrancas.map((c) => c.chave));
  const recebido = new Map<string, number>();
  const ultimo = new Map<string, PagamentoLancado>();
  const lancado = (p: (typeof pagos)[number]): PagamentoLancado => ({
    id: p.id, data: p.data, metodo: p.metodo, pagoPor: p.pagoPor,
    recibo: p.recibo === true, nota: p.nota === true,
  });

  // 1. Os que dizem a qual cobrança pertencem.
  const semChave: typeof pagos = [];
  for (const p of pagos) {
    if (p.cobrancaChave && chaves.has(p.cobrancaChave)) {
      recebido.set(p.cobrancaChave, (recebido.get(p.cobrancaChave) ?? 0) + p.valor);
      ultimo.set(p.cobrancaChave, lancado(p));
    } else {
      semChave.push(p);
    }
  }

  // 2. Os demais, pela ordem de vencimento (as cobranças já chegam ordenadas assim).
  let sobra = 0;
  let fonte: PagamentoLancado | null = null;
  const fila = [...semChave];
  for (const c of cobrancas) {
    let falta = c.valor - (recebido.get(c.chave) ?? 0);
    while (falta > TOLERANCIA) {
      if (sobra <= TOLERANCIA) {
        const p = fila.shift();
        if (!p) break;
        sobra = p.valor;
        fonte = lancado(p);
      }
      const usa = Math.min(sobra, falta);
      sobra -= usa;
      falta -= usa;
      recebido.set(c.chave, (recebido.get(c.chave) ?? 0) + usa);
      if (fonte) ultimo.set(c.chave, fonte);
    }
  }

  return cobrancas.map((c) => {
    const pago = c.valor - (recebido.get(c.chave) ?? 0) <= TOLERANCIA;
    const limite = limiteDaCobranca(c, horasAntes);
    const atrasada = limite ? hoje.getTime() > limite.getTime() : false;
    const situacao: Situacao = pago ? "pago" : atrasada ? "em_atraso" : "em_aberto";
    const falta = pago ? 0 : Math.round((c.valor - (recebido.get(c.chave) ?? 0)) * 100) / 100;
    return { ...c, situacao, falta, pagamento: pago ? (ultimo.get(c.chave) ?? null) : null, envio: enviosPorChave.get(c.chave) ?? null };
  });
}

const comoLinha = ({ tipo, ...c }: CobrancaDaGeral): LinhaDaGeral => ({ ...c, tipo: "pagamento", tipoDeCobranca: tipo });

export function linhasDaGeral(e: EntradaDaGeral): LinhaDaGeral[] {
  const cobrancas = casarPagamentos(cobrancasDoPaciente(e), e.pagamentos, e.hoje, e.envios ?? [], e.horasAntesPagamento ?? 0);
  const rotulos = rotulosDasSessoes(e);

  const naSessao = new Map<string, CobrancaDaGeral>();
  const antes = new Map<string, CobrancaDaGeral[]>();
  const depois = new Map<string, CobrancaDaGeral[]>();
  const sessoes = e.sessoes
    .map((s) => ({ ...s, data: emData(s.date) }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
  const ordem = new Map(sessoes.map((s, i) => [s.id, i]));
  const soltas: CobrancaDaGeral[] = [];

  const empilha = (m: Map<string, CobrancaDaGeral[]>, id: string, c: CobrancaDaGeral) => m.set(id, [...(m.get(id) ?? []), c]);
  for (const c of cobrancas) {
    const ids = c.ids.filter((id) => ordem.has(id)).sort((a, b) => ordem.get(a)! - ordem.get(b)!);
    if (!ids.length) { soltas.push(c); continue; }
    if (c.posicao === "na_sessao") naSessao.set(ids[0], c);
    else if (c.posicao === "antes") empilha(antes, ids[0], c);
    else empilha(depois, ids[ids.length - 1], c);
  }

  const out: LinhaDaGeral[] = [];
  for (const s of sessoes) {
    for (const c of antes.get(s.id) ?? []) out.push(comoLinha(c));

    const cobranca = naSessao.get(s.id) ?? null;
    const pausada = STATUS_QUE_PAUSAM.has(s.status);
    const formato = formatoNaData(e.vigencias, s.data, e.reserva).formato;
    const gratis = rotulos.get(s.id) === "GRAT" || (!s.extra && formato === "gratuito");
    out.push({
      tipo: "sessao",
      id: s.id,
      data: s.data,
      online: !!s.online,
      status: s.status,
      rotulo: rotulos.get(s.id) ?? "",
      // GRAT mostra R$ 0,00 SEMPRE, inclusive com status que pausa (documento de 17/09). Vazio e
      // "R$ 0,00" não dizem a mesma coisa: vazio parece dado faltando, e numa tabela de dinheiro
      // isso vira dúvida sobre se aquela sessão foi cobrada.
      valor: cobranca ? cobranca.valor : gratis ? 0 : null,
      cobranca,
    });

    for (const c of depois.get(s.id) ?? []) out.push(comoLinha(c));
  }
  for (const c of soltas) out.push(comoLinha(c));
  return out;
}

export type MovimentoDoExtrato = {
  id: string;
  data: Date;
  tipo: "pagamento" | "cobranca";
  descricao: string;
  /** Positivo entra (pagamento), negativo sai (cobrança). */
  valor: number;
  /** O saldo depois deste movimento. */
  saldo: number;
  /** Para o recibo. Nulo em crédito de pacote. */
  pagamentoId: string | null;
};

export type ResumoDaGeral = {
  /** Positivo = crédito; negativo = devendo. */
  saldo: number;
  totalPago: number;
  /** Cobranças que já podem ser exigidas: pagas ou em atraso. O que ainda está no prazo não conta. */
  totalExigivel: number;
  /** O que falta receber nas cobranças ainda no prazo (não vencidas). */
  emAberto: number;
  /** O que falta receber nas cobranças vencidas. */
  emAtraso: number;
  /** Quantas COBRANÇAS estão no prazo (em aberto) e quantas vencidas (em atraso) — para o "X em aberto, Y em atraso". */
  nAberto: number;
  nAtraso: number;
  /** Quantas SESSÕES cada balde cobre — contadas, não divididas pelo valor. */
  sessoesEmAberto: number;
  sessoesEmAtraso: number;
  /** Do mais recente para o mais antigo. */
  extrato: MovimentoDoExtrato[];
};

const DESCRICAO: Record<Cobranca["tipo"], (c: Cobranca) => string> = {
  sessao: () => "Sessão",
  extra: () => "Sessão avulsa (fora do pacote)",
  pacote: (c) => `Pacote · ${c.sessoes} ${c.sessoes === 1 ? "sessão" : "sessões"}`,
  quinzena: (c) => `${c.parte === 2 ? "2ª" : "1ª"} quinzena · ${c.sessoes} ${c.sessoes === 1 ? "sessão" : "sessões"}`,
};

/**
 * O SALDO ÚNICO do paciente (dono, 15/09/2026: "um único saldo financeiro, apresentado de forma
 * consistente em todas as telas"). Cartões do topo, Financeiro e Geral leem daqui.
 *
 * Saldo = pagamentos recebidos − cobranças exigíveis. Uma cobrança "a vencer" ainda não é dívida;
 * mas, se já foi paga adiantada, conta — senão o pagamento dela apareceria como crédito falso.
 */
export function resumoDaGeral(e: EntradaDaGeral): ResumoDaGeral {
  const cobrancas = casarPagamentos(cobrancasDoPaciente(e), e.pagamentos, e.hoje, e.envios ?? [], e.horasAntesPagamento ?? 0);
  // Exigível = o que já se pode cobrar: pago ou em atraso. O que ainda está no prazo (em aberto) não
  // entra no saldo — senão uma cobrança futura já apareceria como dívida.
  const exigiveis = cobrancas.filter((c) => c.situacao !== "em_aberto");
  const pagos = e.pagamentos.filter((p) => p.status === "paid");

  const movimentos = [
    ...exigiveis.map((c) => ({
      id: `c:${c.chave}`,
      data: (c.vencimento ?? c.competencia) as Date,
      tipo: "cobranca" as const,
      descricao: DESCRICAO[c.tipo](c),
      valor: -c.valor,
      pagamentoId: null,
    })),
    ...pagos.map((p) => ({
      id: `p:${p.id}`,
      data: emData(p.data),
      tipo: "pagamento" as const,
      descricao: p.kind === "pacote" ? "Crédito de pacote" : `Pagamento recebido${p.pagoPor ? ` · ${p.pagoPor}` : ""}`,
      valor: Number(p.valor) || 0,
      pagamentoId: p.kind === "pacote" ? null : p.id,
    })),
  ]
    .filter((m) => m.data instanceof Date && !Number.isNaN(m.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === "cobranca" ? -1 : 1));

  let corrente = 0;
  const extrato = movimentos.map((m) => {
    corrente = Math.round((corrente + m.valor) * 100) / 100;
    return { ...m, saldo: corrente };
  });

  const soma = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  const totalPago = soma(pagos.map((p) => Number(p.valor) || 0));
  const totalExigivel = soma(exigiveis.map((c) => c.valor));
  // "Em aberto" é o que dá para cobrar AGORA: o mês vigente e o que ficou para trás. Cobrança de
  // mês futuro inflava o número que a terapeuta usa para saber quanto tem a receber — dinheiro que
  // ainda nem podia ser pedido (documento de 17/09).
  const fimDoMes = new Date(e.hoje.getFullYear(), e.hoje.getMonth() + 1, 0, 23, 59, 59, 999);
  const doMesOuAnterior = (c: CobrancaDaGeral) => {
    const quando = c.vencimento ?? c.competencia ?? null;
    return !quando || quando.getTime() <= fimDoMes.getTime();
  };
  const emAberto = cobrancas.filter((c) => c.situacao === "em_aberto" && doMesOuAnterior(c));
  const emAtraso = cobrancas.filter((c) => c.situacao === "em_atraso");
  // As DUAS quinzenas contam. Enquanto cada uma cobrava metade do pacote, as duas diziam o total
  // inteiro e somar dobrava — dai o descarte da parte 2. Desde 17/09 cada quinzena carrega as
  // sessoes que cairam nela, e ignorar a segunda passaria a subcontar.
  const sessoes = (cs: typeof cobrancas) => cs.reduce((a, c) => a + c.sessoes, 0);
  return {
    saldo: Math.round((totalPago - totalExigivel) * 100) / 100,
    totalPago,
    totalExigivel,
    emAberto: soma(emAberto.map((c) => c.falta)),
    emAtraso: soma(emAtraso.map((c) => c.falta)),
    nAberto: emAberto.length,
    nAtraso: emAtraso.length,
    sessoesEmAberto: sessoes(emAberto),
    sessoesEmAtraso: sessoes(emAtraso),
    extrato: extrato.reverse(),
  };
}
