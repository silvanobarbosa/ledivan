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
  /**
   * Qual sessão desmarcada esta aqui repõe. É o que separa dois casos que, sem ele, chegam como
   * dados idênticos — um mês com uma desmarcada e uma sessão a mais — e pedem contas diferentes:
   * reposição OCUPA a vaga aberta, sessão a mais CRIA uma vaga nova.
   */
  repoeSessaoId?: string | null;
  /**
   * Segura a posição sem ocupá-la, como Desmarcou e Atestado fazem pelo status (doc 54).
   *
   * Existe porque nem toda pausa cabe num status: "Faltou" com a resposta "não abater do pacote"
   * precisa PAUSAR a sequência e, ao mesmo tempo, continuar sendo Faltou na agenda — a cor e o
   * texto são do status, a pausa é da resposta. Quem decide isso é quem chama; aqui só se obedece.
   */
  pausa?: boolean | null;
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
  /**
   * Quantidade de sessões do pacote COMPLETO, informada pelo usuário (doc 16, 03/10/2026):
   * acabou o padrão fixo de 4/8 — quem define o tamanho do pacote completo é o cadastro
   * (`patients.sessions_in_packet`). Vazio/0 cai no comportamento antigo (4 × vezes por semana),
   * para não quebrar pacientes que nunca informaram. Só vale para o COMPLETO; o fracionado é o mês.
   */
  tamanhoPacote?: number | null;
  /**
   * Quantas sessões por semana o paciente tem combinadas (1 ou 2). Vem do cadastro
   * (`patients.times_per_period`).
   *
   * É o que faz o pacote de quem vem 2x por semana ter OITO sessões em vez de quatro (documento de
   * 17/09). O pacote fechado sempre foi "um mês de sessões semanais"; para quem vem duas vezes, um
   * mês são oito. Sem isso, oito sessões no mês viravam duas sequências de quatro — dois pagamentos
   * onde o combinado é um.
   */
  vezesPorSemana?: number;
  /**
   * Vigências do TAMANHO do pacote completo (doc 30). Quando o tamanho muda com uma data em "Vale a
   * partir de", a mudança vale só das sessões com data >= a vigência: o anterior fica intacto e a
   * sequência REINICIA em 1/N na vigência. Cada item = { desde, tamanho }. Vazio = comportamento
   * antigo (um tamanho só para tudo, via `tamanhoPacote`). Só vale para o COMPLETO.
   */
  tamanhosPorData?: { desde: Date | string; tamanho: number }[];
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

/** Pausa pelo status (Desmarcou, Atestado, Prof. desm.) ou pela resposta de quem chamou (doc 54). */
const pausou = (s: { status: string; pausa?: boolean | null }): boolean => !!s.pausa || STATUS_QUE_PAUSAM.has(s.status);

/**
 * TRANSPARENTE: pausa que veio da RESPOSTA, não do status.
 *
 * A diferença importa em dinheiro, e custou uma regressão para aparecer. Desmarcou e Atestado são
 * sessões CONTRATADAS que não aconteceram: elas sempre ocuparam uma vaga do mês e sempre contaram
 * no denominador — "o denominador não encolhe", que é a regra do fracionado.
 *
 * A falta não abatida e a cortesia são outra coisa. Até ontem elas eram TIRADAS do pacote, então
 * não criavam vaga, não moviam o começo da sequência e não entravam no valor da quinzena. Ao
 * passarem a pausar, passaram a existir no fluxo — e, sem esta distinção, cada uma delas somava uma
 * vaga, empurrava a data de vencimento e fazia a quinzena cobrar uma sessão a mais.
 *
 * Então elas pausam para EXIBIR (mantêm o número onde pararam, a próxima assume a posição) e são
 * invisíveis para CONTAR. É exatamente o que o dono pediu nas duas telas.
 */
const transparente = (s: { pausa?: boolean | null }): boolean => !!s.pausa;

/** Descarta o que não dá para posicionar e ordena pelo que manda: a data. */
function emOrdem(sessoes: SessaoDaSequencia[]): { id: string; data: Date; status: string; repoe: string | null; pausa: boolean }[] {
  return sessoes
    .map((s) => ({ id: s.id, data: emData(s.date), status: s.status, repoe: s.repoeSessaoId ?? null, pausa: !!s.pausa }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    // Duas no mesmo instante acontecem (encaixe, casal). O id desempata para que a numeração seja
    // sempre a mesma — ordem instável aqui faria o número dançar a cada recarga da tela.
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
}

/** Os tamanhos contratados, limpos. Lista vazia = o contrato não diz nada sobre este paciente. */
function contratados(opts: OpcoesDaSequencia): number[] {
  return (opts.tamanhos ?? []).filter((n) => Number.isFinite(n) && n >= 1).map((n) => Math.floor(n));
}

/** O tamanho da sequência de índice `i`, com o último da lista valendo para as seguintes. */
function tamanhoDe(opts: OpcoesDaSequencia, i: number): number {
  // Contrato registrado manda sobre tudo.
  const lista = opts.pacoteTipo === "fragmentado" ? contratados(opts) : [];
  if (lista.length) return lista[Math.min(i, lista.length - 1)];
  // Completo com quantidade informada pelo usuário manda (doc 16): acabou o padrão 4/8.
  const qtd = Number(opts.tamanhoPacote);
  if (opts.pacoteTipo !== "fragmentado" && Number.isFinite(qtd) && qtd >= 1) return Math.floor(qtd);
  // Senão, o pacote é um mês do ritmo combinado: 4 para quem vem 1x por semana, 8 para 2x.
  const vezes = Math.max(1, Math.floor(opts.vezesPorSemana ?? 1));
  return TAMANHO_PADRAO * vezes;
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
  // Fracionado SEM contrato registrado: o mês define a sequência (a regra própria, abaixo). Com
  // contrato, ele manda — e aí a varredura é a mesma do completo, só que com tamanhos por sequência.
  if (opts.pacoteTipo === "fragmentado" && contratados(opts).length === 0) return posicoesFragmentado(sessoes);

  // Doc 30: vigências do tamanho (completo). Ordenadas por data. Com elas, a sequência reinicia em
  // 1/N a cada vigência alcançada; sem elas, o tamanho é um só (comportamento antigo).
  const vigs = (opts.tamanhosPorData ?? [])
    .map((v) => ({ desde: emData(v.desde), tamanho: Math.floor(v.tamanho) }))
    .filter((v) => !Number.isNaN(v.desde.getTime()) && v.tamanho >= 1)
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());
  const usaVigencia = vigs.length > 0;
  const tamanhoNaData = (data: Date): number => {
    let t = tamanhoDe(opts, 0);
    for (const v of vigs) { if (v.desde.getTime() <= data.getTime()) t = v.tamanho; else break; }
    return t;
  };

  const mapa = new Map<string, PosicaoNaSequencia>();

  let sequencia = 0;
  let posicao = 1;
  let total = tamanhoDe(opts, 0);
  let ultimaVig = -Infinity; // a vigência que iniciou a sequência atual (para reiniciar só uma vez)

  for (const s of emOrdem(sessoes)) {
    // Alcançou uma vigência nova? Reinicia a sequência em 1/N a partir desta data (doc 30).
    if (usaVigencia) {
      const ativa = vigs.filter((v) => v.desde.getTime() <= s.data.getTime()).pop();
      if (ativa && ativa.desde.getTime() > ultimaVig) {
        if (!(sequencia === 0 && posicao === 1)) sequencia += 1; // não cria sequência vazia no começo
        posicao = 1;
        total = ativa.tamanho;
        ultimaVig = ativa.desde.getTime();
      }
    }

    mapa.set(s.id, { sequencia, index: posicao, total });

    // Pausou: a posição fica de pé para a próxima sessão ocupar.
    if (pausou(s)) continue;

    posicao += 1;
    if (posicao > total) {
      sequencia += 1;
      posicao = 1;
      total = usaVigencia ? tamanhoNaData(s.data) : tamanhoDe(opts, sequencia);
    }
  }

  return mapa;
}

/**
 * FRAGMENTADO: cada MÊS do calendário é uma sequência própria, do tamanho dos atendimentos marcados
 * para aquele mês (dono, 16/09/2026). Setembro com três numera 1/3..3/3; outubro com quatro,
 * 1/4..4/4 — os meses não se juntam.
 *
 * O que o documento de 17/09 acrescentou é o que acontece quando uma sessão do mês não acontece, e
 * é a razão desta função ter deixado de ser uma contagem por mês:
 *
 * Esta função só entra quando o contrato NÃO diz o tamanho das sequências (`tamanhos` vazio) — o caso
 * de todos os fracionados de hoje. Havendo contrato, quem manda é ele, e a varredura comum dá conta.
 *
 * **O denominador não encolhe.** Setembro com três marcadas e uma desmarcada continua /3 — o
 * paciente contratou três atendimentos. A vaga aberta é ocupada pela próxima sessão real, que pode
 * já ser de outubro: ela ATRAVESSA, exibindo 3/3, e pertence à sequência de setembro. Outubro
 * recomeça na seguinte, com as vagas que ainda são dele. Antes o total era "quantas ocuparam", e
 * setembro virava /2 — cobrando duas sessões onde três foram contratadas.
 *
 * **Reposição não cria vaga.** Uma sessão marcada para repor outra (`repoeSessaoId`) ocupa a vaga
 * que a desmarcada deixou, em vez de acrescentar uma quarta ao mês. Sem esse vínculo os dois casos
 * do documento — desmarcou sem repor (F1) e repôs no mesmo mês (F2) — chegam aqui como dados
 * idênticos e exigem contas diferentes; não há como decidir por dedução.
 *
 * Desmarcou, Prof. desm. e Atestado continuam segurando a posição sem ocupá-la, como no completo. E
 * a conta segue refeita do zero, nunca guardada.
 */
function posicoesFragmentado(sessoes: SessaoDaSequencia[]): Map<string, PosicaoNaSequencia> {
  const mapa = new Map<string, PosicaoNaSequencia>();
  const ordenadas = emOrdem(sessoes);
  const chaveDoMes = (d: Date) => d.getFullYear() * 12 + d.getMonth();

  // As vagas de cada mês, na ordem do calendário: uma por atendimento marcado para ele.
  const vagas = new Map<number, number>();
  const meses: number[] = [];
  for (const s of ordenadas) {
    const k = chaveDoMes(s.data);
    if (!vagas.has(k)) { vagas.set(k, 0); meses.push(k); }
    // Pausa por resposta não cria vaga: ela não é uma sessão contratada a mais.
    if (!s.repoe && !transparente(s)) vagas.set(k, vagas.get(k)! + 1);
  }

  // Preenche mês a mês, consumindo de uma fila única — é o que permite a sessão de outubro fechar
  // setembro sem sair da ordem em que as coisas aconteceram.
  const gastas = new Map<number, number>(); // vagas de um mês já usadas por um mês anterior
  let ponteiro = 0;
  let sequencia = 0;

  for (const k of meses) {
    const total = (vagas.get(k) ?? 0) - (gastas.get(k) ?? 0);
    if (total <= 0) continue; // o mês inteiro já foi absorvido pelo anterior: não tem sequência própria

    let ocupadas = 0;
    while (ocupadas < total && ponteiro < ordenadas.length) {
      const s = ordenadas[ponteiro++];
      const mesDela = chaveDoMes(s.data);
      if (mesDela !== k && !s.repoe && !transparente(s)) gastas.set(mesDela, (gastas.get(mesDela) ?? 0) + 1);
      // O clamp evita "4/3" quando o mês termina numa sessão que pausou.
      mapa.set(s.id, { sequencia, index: Math.min(ocupadas + 1, total), total });
      if (!pausou(s)) ocupadas++;
    }
    sequencia++;
  }

  return mapa;
}


type DadosDaSequencia = {
  total: number;
  ids: string[];
  /** Datas das sessões que OCUPARAM posição — são elas que datam a cobrança. */
  primeira: Date | null;
  ultima: Date | null;
  maiorIndex: number;
  /** A última sessão que ocupou posição, para saber se a sequência fechou. */
  ultimaOcupante: { id: string; data: Date } | null;
};

/**
 * Agrupa as sessões por sequência, separando o que ela CONTÉM do que a DATA.
 *
 * `ids` carrega tudo — é o grupo de pagamento, e o doc 54 exige que a falta não abatida e a
 * cortesia continuem dentro dele. `primeira`/`ultima` olham só quem OCUPOU posição, porque são
 * elas que decidem dinheiro: quando o pacote começou (vencimento) e quando fechou (competência,
 * que é o mês em que a Fechamento soma).
 *
 * Misturar as duas coisas foi a regressão: uma falta não abatida na primeira sessão puxava o
 * vencimento do pacote para a data dela, e na última deixava a sequência eternamente aberta —
 * sumindo com a cobrança do mês.
 */
function agrupar(
  ordenadas: { id: string; data: Date; status: string; pausa?: boolean | null }[],
  posicoes: Map<string, PosicaoNaSequencia>,
): Map<number, DadosDaSequencia> {
  const porSequencia = new Map<number, DadosDaSequencia>();
  for (const s of ordenadas) {
    const p = posicoes.get(s.id);
    if (!p) continue;
    let atual = porSequencia.get(p.sequencia);
    if (!atual) {
      atual = { total: p.total, ids: [], primeira: null, ultima: null, maiorIndex: 0, ultimaOcupante: null };
      porSequencia.set(p.sequencia, atual);
    }
    atual.ids.push(s.id);
    if (transparente(s)) continue; // está no grupo, mas não data nem fecha nada
    if (!atual.primeira || s.data.getTime() < atual.primeira.getTime()) atual.primeira = s.data;
    if (!atual.ultima || s.data.getTime() > atual.ultima.getTime()) atual.ultima = s.data;
    if (p.index > atual.maiorIndex) atual.maiorIndex = p.index;
    if (!atual.ultimaOcupante || s.data.getTime() >= atual.ultimaOcupante.data.getTime()) {
      atual.ultimaOcupante = { id: s.id, data: s.data };
    }
  }
  return porSequencia;
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
  const porSequencia = agrupar(ordenadas, posicoes);

  const out: SequenciaFechada[] = [];
  for (const [sequencia, dados] of porSequencia) {
    // Fechou quando a última posição foi OCUPADA. Quem decide é a última ocupante — uma sessão
    // pausada depois dela não reabre o pacote, e uma pausada por resposta nem conta.
    const ultimaSessao = dados.ultimaOcupante
      ? ordenadas.find((s) => s.id === dados.ultimaOcupante!.id)
      : undefined;
    const ocupouAUltima = dados.maiorIndex >= dados.total && !!ultimaSessao && !pausou(ultimaSessao);
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

  const porSequencia = agrupar(ordenadas, posicoes);

  const escolhidas: SequenciaFechada[] = [];
  for (const [sequencia, dados] of porSequencia) {
    // Fechou quando a última posição foi OCUPADA — e ocupar é diferente de existir: uma sessão
    // pausada na posição final deixa a sequência aberta, esperando a reposição.
    // Fechou quando a última posição foi OCUPADA. Quem decide é a última ocupante — uma sessão
    // pausada depois dela não reabre o pacote, e uma pausada por resposta nem conta.
    const ultimaSessao = dados.ultimaOcupante
      ? ordenadas.find((s) => s.id === dados.ultimaOcupante!.id)
      : undefined;
    const ocupouAUltima = dados.maiorIndex >= dados.total && !!ultimaSessao && !pausou(ultimaSessao);

    // Quem paga na abertura cobra assim que a sequência COMEÇA, mesmo ela ainda estando aberta —
    // é o que "paga na primeira do pacote" quer dizer. Quem paga depois só entra quando fecha.
    const referencia = momento === "abertura" ? dados.primeira : dados.ultima;
    if (momento === "fechamento" && !ocupouAUltima) continue;
    if (!referencia || referencia.getFullYear() !== ano || referencia.getMonth() !== mes) continue;

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
