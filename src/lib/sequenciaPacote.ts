/**
 * A SEQUÊNCIA DO PACOTE: o 1/4, 2/4, 3/4 que aparece na célula da agenda.
 *
 * Este é o motor do lote das beta testers, e a peça de maior risco dele. Três decisões o
 * estruturam, e vale dizer quais são antes do código:
 *
 * 1. **A conta é REFEITA, nunca guardada.** Não existe contador no banco dizendo "este paciente
 *    está na sessão 3". O lote pede exatamente as três operações que quebram contador — alterar o
 *    status de uma sessão passada, encaixar uma no meio, excluir em bloco — e cada uma obrigaria a
 *    desfazer o efeito antigo e aplicar o novo, em todo caminho do código, sempre. Errar uma vez
 *    deixaria o número errado na tela sem nenhum aviso. Varrendo as sessões em ordem não há
 *    segunda versão da verdade para divergir.
 *
 * 2. **Alguns status avançam, outros PAUSAM.** Presente, Faltou e sem status ocupam a posição: o
 *    lugar foi usado, o paciente tendo vindo ou não. Desmarcou, Prof. desm. e Atestado seguram, e
 *    a próxima sessão assume a mesma posição — o paciente não perde a sessão dele. A sessão
 *    pausada continua exibindo onde parou, em vez de ficar muda.
 *
 * 3. **Quem agrupa é a SEQUÊNCIA, não o mês do calendário.** Uma sequência de setembro com uma
 *    pausa no meio termina em outubro, e aquela última sessão ainda pertence a setembro. Era aqui
 *    que o cálculo antigo errava: agrupando por mês, cada desmarcação encolhia o total, e um
 *    paciente com três sessões contratadas via "1/2, 2/2" na tela.
 *
 * O tamanho de cada sequência é o que se guarda, porque não se deduz de nada: quantas sessões
 * foram contratadas. Quantas foram usadas se deduz, e por isso não se guarda.
 */

import { STATUS_QUE_PAUSAM } from "./therapy";

/** O pacote fechado padrão: quatro sessões. É o combinado quando nada diz o contrário. */
export const TAMANHO_PADRAO = 4;

export type SessaoDaSequencia = {
  id: string;
  date: Date | string;
  status: string;
};

export type PosicaoNaSequencia = {
  /** Qual sequência do paciente, a partir de zero. */
  sequencia: number;
  /** A posição dentro dela: o X da esquerda. */
  index: number;
  /** O tamanho dela: o X da direita. */
  total: number;
};

export type OpcoesDaSequencia = {
  pacoteTipo?: "completo" | "fragmentado" | string | null;
  /**
   * Quantas sessões cada sequência tem, na ordem em que foram contratadas. Só vale para o
   * fracionado — no completo são sempre quatro. Acabando a lista, o último tamanho continua
   * valendo, que é o comportamento de quem contratou um ritmo e seguiu nele.
   */
  tamanhos?: number[];
};

export type SequenciaFechada = {
  sequencia: number;
  total: number;
  /** A data da sessão que fechou a sequência. É por ela que a cobrança sabe em que mês cai. */
  fechouEm: Date | null;
  /** A data da primeira sessão dela — quem paga na abertura do pacote cobra por esta. */
  comecouEm: Date | null;
  ids: string[];
};

/**
 * Em que momento a sequência entra na conta do mês.
 *
 * `fechamento` é o caso comum: o pacote cobra quando fica completo. `abertura` existe para quem
 * paga na PRIMEIRA sessão do pacote — nesse combinado o dinheiro vence lá no começo, e esperar a
 * sequência fechar mostraria o paciente devendo num mês e tendo pago a mais no outro, com as duas
 * telas erradas ao mesmo tempo.
 */
export type MomentoDaCobranca = "abertura" | "fechamento";

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/** Descarta o que não dá para posicionar e ordena pelo que manda: a data. */
function emOrdem(sessoes: SessaoDaSequencia[]): { id: string; data: Date; status: string }[] {
  return sessoes
    .map((s) => ({ id: s.id, data: emData(s.date), status: s.status }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    // Duas no mesmo instante acontecem (encaixe, casal). O id desempata para que a numeração seja
    // sempre a mesma — ordem instável aqui faria o número dançar a cada recarga da tela.
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
}

/** O tamanho da sequência de índice `i`, com o último da lista valendo para as seguintes. */
function tamanhoDe(opts: OpcoesDaSequencia, i: number): number {
  if (opts.pacoteTipo !== "fragmentado") return TAMANHO_PADRAO;
  const lista = (opts.tamanhos ?? []).filter((n) => Number.isFinite(n) && n >= 1).map((n) => Math.floor(n));
  if (lista.length === 0) return TAMANHO_PADRAO;
  return lista[Math.min(i, lista.length - 1)];
}

/**
 * A varredura: percorre as sessões em ordem e diz onde cada uma cai.
 *
 * É a função de que tudo o mais depende — a célula da agenda, a cobrança e o recálculo depois de
 * qualquer edição saem todos daqui.
 */
export function posicoesDaSequencia(
  sessoes: SessaoDaSequencia[],
  opts: OpcoesDaSequencia = {},
): Map<string, PosicaoNaSequencia> {
  if (opts.pacoteTipo === "fragmentado") return posicoesFragmentado(sessoes);

  const mapa = new Map<string, PosicaoNaSequencia>();

  let sequencia = 0;
  let posicao = 1;
  let total = tamanhoDe(opts, 0);

  for (const s of emOrdem(sessoes)) {
    mapa.set(s.id, { sequencia, index: posicao, total });

    // Pausou: a posição fica de pé para a próxima sessão ocupar.
    if (STATUS_QUE_PAUSAM.has(s.status)) continue;

    posicao += 1;
    if (posicao > total) {
      sequencia += 1;
      posicao = 1;
      total = tamanhoDe(opts, sequencia);
    }
  }

  return mapa;
}

/**
 * FRAGMENTADO: cada MÊS do calendário é uma sequência própria, do tamanho dos atendimentos daquele
 * mês (dono, 16/09/2026). Setembro com três sessões numera 1/3..3/3; outubro com quatro, 1/4..4/4 —
 * os meses não se juntam. O total do mês são as sessões que OCUPAM (não pausam); Desmarcou, Prof.
 * desm. e Atestado seguram a posição sem contar, como no completo. A conta é refeita, nunca guardada.
 */
function posicoesFragmentado(sessoes: SessaoDaSequencia[]): Map<string, PosicaoNaSequencia> {
  const mapa = new Map<string, PosicaoNaSequencia>();
  const ordenadas = emOrdem(sessoes);
  const chaveDoMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();

  // Total do mês = atendimentos que ocupam. E a sequência de cada mês, na ordem do calendário.
  const totalPorMes = new Map<number, number>();
  const seqPorMes = new Map<number, number>();
  let proximaSeq = 0;
  for (const s of ordenadas) {
    const k = chaveDoMes(s.data);
    if (!seqPorMes.has(k)) seqPorMes.set(k, proximaSeq++);
    if (!STATUS_QUE_PAUSAM.has(s.status)) totalPorMes.set(k, (totalPorMes.get(k) ?? 0) + 1);
  }

  const ocupadasNoMes = new Map<number, number>(); // quantas já ocuparam posição no mês
  for (const s of ordenadas) {
    const k = chaveDoMes(s.data);
    const sequencia = seqPorMes.get(k)!;
    const total = Math.max(1, totalPorMes.get(k) ?? 0);
    // A posição é a próxima a preencher; o clamp evita "3/2" quando um mês termina numa pausa.
    const index = Math.min((ocupadasNoMes.get(k) ?? 0) + 1, total);
    mapa.set(s.id, { sequencia, index, total });
    if (!STATUS_QUE_PAUSAM.has(s.status)) ocupadasNoMes.set(k, (ocupadasNoMes.get(k) ?? 0) + 1);
  }

  return mapa;
}

/**
 * TODAS as sequências do paciente, com quando cada uma começou e fechou.
 *
 * É a base da cobrança acumulada: filtrar por mês aqui dentro impediria somar o histórico inteiro,
 * que é justamente o que a posição real exige.
 */
export function todasAsSequencias(
  sessoes: SessaoDaSequencia[],
  opts: OpcoesDaSequencia,
): SequenciaFechada[] {
  const ordenadas = emOrdem(sessoes);
  const posicoes = posicoesDaSequencia(sessoes, opts);
  const porSequencia = new Map<number, { total: number; ids: string[]; primeira: Date; ultima: Date; maiorIndex: number }>();

  for (const s of ordenadas) {
    const p = posicoes.get(s.id);
    if (!p) continue;
    const atual = porSequencia.get(p.sequencia);
    if (!atual) {
      porSequencia.set(p.sequencia, { total: p.total, ids: [s.id], primeira: s.data, ultima: s.data, maiorIndex: p.index });
      continue;
    }
    atual.ids.push(s.id);
    if (s.data.getTime() > atual.ultima.getTime()) atual.ultima = s.data;
    if (p.index > atual.maiorIndex) atual.maiorIndex = p.index;
  }

  const out: SequenciaFechada[] = [];
  for (const [sequencia, dados] of porSequencia) {
    const ultimaSessao = ordenadas.find((s) => s.id === dados.ids[dados.ids.length - 1]);
    const ocupouAUltima = dados.maiorIndex >= dados.total && !!ultimaSessao && !STATUS_QUE_PAUSAM.has(ultimaSessao.status);
    out.push({
      sequencia,
      total: dados.total,
      fechouEm: ocupouAUltima ? dados.ultima : null,
      comecouEm: dados.primeira,
      ids: dados.ids,
    });
  }
  return out.sort((a, b) => a.sequencia - b.sequencia);
}

/**
 * As sequências que FECHARAM dentro daquele mês.
 *
 * É por aqui que a cobrança passa a seguir a sequência em vez da data, que foi a decisão do dono.
 * Uma sequência de setembro empurrada por uma pausa fecha em outubro, e cobra em outubro — a conta
 * do mês para de encolher quando alguém desmarca, que era o defeito do cálculo por calendário.
 *
 * Sequência ainda aberta não entra: ninguém cobra um pacote pela metade.
 */
export function sequenciasFechadasNoMes(
  sessoes: SessaoDaSequencia[],
  opts: OpcoesDaSequencia,
  ano: number,
  mes: number,
  momento: MomentoDaCobranca = "fechamento",
): SequenciaFechada[] {
  const ordenadas = emOrdem(sessoes);
  const posicoes = posicoesDaSequencia(sessoes, opts);

  const porSequencia = new Map<number, { total: number; ids: string[]; primeira: Date; ultima: Date; maiorIndex: number }>();

  for (const s of ordenadas) {
    const p = posicoes.get(s.id);
    if (!p) continue;
    const atual = porSequencia.get(p.sequencia);
    if (!atual) {
      porSequencia.set(p.sequencia, { total: p.total, ids: [s.id], primeira: s.data, ultima: s.data, maiorIndex: p.index });
      continue;
    }
    atual.ids.push(s.id);
    if (s.data.getTime() > atual.ultima.getTime()) atual.ultima = s.data;
    if (p.index > atual.maiorIndex) atual.maiorIndex = p.index;
  }

  const escolhidas: SequenciaFechada[] = [];
  for (const [sequencia, dados] of porSequencia) {
    // Fechou quando a última posição foi OCUPADA — e ocupar é diferente de existir: uma sessão
    // pausada na posição final deixa a sequência aberta, esperando a reposição.
    const ultimaSessao = ordenadas.find((s) => s.id === dados.ids[dados.ids.length - 1]);
    const ocupouAUltima = dados.maiorIndex >= dados.total && !!ultimaSessao && !STATUS_QUE_PAUSAM.has(ultimaSessao.status);

    // Quem paga na abertura cobra assim que a sequência COMEÇA, mesmo ela ainda estando aberta —
    // é o que "paga na primeira do pacote" quer dizer. Quem paga depois só entra quando fecha.
    const referencia = momento === "abertura" ? dados.primeira : dados.ultima;
    if (momento === "fechamento" && !ocupouAUltima) continue;
    if (referencia.getFullYear() !== ano || referencia.getMonth() !== mes) continue;

    escolhidas.push({
      sequencia,
      total: dados.total,
      fechouEm: ocupouAUltima ? dados.ultima : null,
      comecouEm: dados.primeira,
      ids: dados.ids,
    });
  }

  return escolhidas.sort((a, b) => a.sequencia - b.sequencia);
}

/**
 * Os tamanhos contratados, lidos dos pacotes do paciente.
 *
 * O pacote é o que se guarda — é o combinado, e não se deduz das sessões. Pacote de tamanho
 * inválido é descartado em vez de virar "0/0" na célula.
 */
export function tamanhosDasSequencias(pacotes: { seq: number; sessions: number | null }[]): number[] {
  return [...pacotes]
    .sort((a, b) => a.seq - b.seq)
    .map((p) => Number(p.sessions))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .map((n) => Math.floor(n));
}
