/**
 * O MOTOR ÚNICO DE COBRANÇAS.
 *
 * Responde, para um paciente, UMA pergunta com três usos: o que ele deve, de quais sessões, e
 * quando. A Fechamento soma por mês; a guia Geral desenha linha a linha; a célula da agenda escreve
 * o rótulo. Antes cada tela montava a sua conta, e já divergiam — a agenda tirava a devolutiva comum
 * da sequência, a Fechamento não. Com a guia Geral seriam três versões da verdade. Agora é uma.
 *
 * AS REGRAS, e de onde vêm:
 *
 * 1. **O formato vale no seu período** (dono, 15/09/2026). Cada sessão é cobrada pelo formato que
 *    valia no DIA dela — ver `vigenciaDoFormato.ts`. Trocar o formato hoje não cria, apaga nem muda
 *    cobrança passada. Uma troca abre sequência nova: é um contrato novo.
 *
 * 2. **Pacote cobra a sequência, não o mês** (dono, 13/09/2026). Mensal, quinzenal e "última do
 *    pacote" entram na Fechamento quando a sequência FECHA; "primeira do pacote", quando ela abre.
 *    Isso é a `competencia`. O `vencimento` é outra coisa — é o dia que a guia Geral mostra para
 *    cobrar — e por isso os dois são campos separados.
 *
 * 3. **O valor é sessão × quantidade** (dono, 15/09/2026). Mensal de 4 a R$ 130 = R$ 520;
 *    fragmentado de 3 = R$ 390; quinzenal divide o pacote em duas cobranças de metade.
 *
 * 4. **Devolutiva comum fica fora da sequência e não cobra**; a marcada para abater ocupa posição.
 *    É o que a agenda já fazia — agora a Fechamento concorda.
 *
 * 4b. **Devolutiva gratuita em "a cada sessão" é GRAT** (dono, 15/09/2026): marcada para não cobrar
 *    (`chargeable = false`), não gera cobrança e o rótulo é GRAT. A cobrada segue cobrada, como DEVOL.
 *
 * 5. **Sessão extra fora da sequência é independente do financeiro** (dono, 15/09/2026). AVUL gera
 *    cobrança própria no valor informado, mesmo com o paciente gratuito; GRAT não gera nada. Nenhuma
 *    das duas altera a numeração, o tamanho ou o valor do pacote — antes, durante ou depois dele.
 *
 * A conta é REFEITA a cada leitura, nunca guardada (mesma decisão da sequência): o que se guarda
 * são os fatos — sessões, preços, trocas de formato, pagamentos.
 *
 * Função pura.
 */

import { codigoDaSessao } from "./celulaDaAgenda";
import { precoCobravel, type PrecoVigente } from "./preco";
import { cobra, usaPacote } from "./reajuste";
import { posicoesDaSequencia, todasAsSequencias } from "./sequenciaPacote";
import { STATUS_QUE_PAUSAM } from "./therapy";
import { periodosDeVigencia, separarPorVigencia, type PeriodoDeVigencia, type VigenciaDoFormato } from "./vigenciaDoFormato";

export type SessaoDaCobranca = {
  id: string;
  date: Date | string;
  status: string;
  /** `consulta` (padrão) ou `devolutiva`. */
  sessionKind?: string | null;
  /** Devolutiva que ocupa posição na sequência. */
  abaterDoPacote?: boolean | null;
  /** Falso = marcada para não cobrar. Hoje só a devolutiva oferece essa escolha. */
  chargeable?: boolean | null;
  /** Doc 45: numa sessão "Faltou", false = NÃO considerar realizada (não cobra, não abate do pacote).
   *  null/true = considerar (comportamento padrão). Só vale quando o status é nao_realizada. */
  faltouConta?: boolean | null;
  /** Sessão extra, FORA da sequência: `avul` cobra à parte, `grat` não cobra. */
  extra?: "avul" | "grat" | string | null;
  /** O valor informado da extra avulsa. */
  valorExtra?: number | string | null;
  /** Qual sessao desmarcada esta aqui repoe (documento de 17/09). Reposicao ocupa vaga, nao cria. */
  repoeSessaoId?: string | null;
  /** Doc 54: atendimento do pacote dado de cortesia. Não cobra e não ocupa posição, mas continua no pacote. */
  cortesia?: boolean | null;
};

export type TipoDeCobranca = "sessao" | "pacote" | "quinzena" | "extra";

export type Cobranca = {
  /** Estável entre duas leituras iguais: é por ela que um pagamento se prende à cobrança. */
  chave: string;
  tipo: TipoDeCobranca;
  /** O formato do período em que ela nasceu. Extra carrega `extra`. */
  formato: string;
  valor: number;
  /** Quantas sessões ela cobre. */
  sessoes: number;
  ids: string[];
  /** O dia de cobrar, que a guia Geral mostra. */
  vencimento: Date | null;
  /** O dia que a põe na Fechamento. `null` = ainda não entra (pacote aberto). */
  competencia: Date | null;
  /** Onde a linha de pagamento vai na guia Geral, em relação às sessões dela. */
  posicao: "antes" | "depois" | "na_sessao";
  /** Quinzenal: primeira ou segunda metade. */
  parte?: 1 | 2;
};

export type EntradaDasCobrancas = {
  vigencias: VigenciaDoFormato[];
  /** O formato do cadastro — vale quando o histórico está vazio. */
  reserva: { formato: string | null | undefined; pacoteTipo?: string | null };
  sessoes: SessaoDaCobranca[];
  precos: PrecoVigente[];
  /** O valor da sessão no cadastro: reserva de quando o histórico de preço não alcança a data. */
  valorDaSessao?: number | null;
  /** Os tamanhos contratados, na ordem. Só o fragmentado usa. */
  tamanhos?: number[];
  /** Quantidade de sessões do pacote COMPLETO informada no cadastro (doc 16). Vazio = padrão 4/8. */
  tamanhoPacote?: number | null;
  /** Vigências do tamanho do pacote (doc 30): { desde, tamanho }. Vazio = tamanho único. */
  tamanhosPorData?: { desde: Date | string; tamanho: number }[];
  /** 1 ou 2 sessões por semana (cadastro). Define o tamanho do pacote fechado: 4 ou 8. */
  vezesPorSemana?: number;
  diaPagamento?: number | null;
  diaPagamento2?: number | null;
  /**
   * Vencimentos EDITADOS à mão (doc 31): a terapeuta trocou o dia de uma cobrança específica. Uma
   * entrada por `chave`. Sem entrada, o motor usa o vencimento que ele mesmo calcula. Apagar a
   * entrada (voltar ao padrão) é o "desfazer" — o motor recalcula o original.
   */
  vencimentos?: { chave: string; vencimento: Date | string }[];
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const dinheiro = (v: number) => Math.round(v * 100) / 100;
const chaveDoDia = (d: Date | null) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "inicio";

type Ordenada = SessaoDaCobranca & { data: Date };

function emOrdem(sessoes: SessaoDaCobranca[]): Ordenada[] {
  return sessoes
    .map((s) => ({ ...s, data: emData(s.date) }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
}

const ehExtra = (s: SessaoDaCobranca) => s.extra === "avul" || s.extra === "grat";
const devolutivaGratuita = (s: SessaoDaCobranca) => s.sessionKind === "devolutiva" && s.chargeable === false;
/**
 * "Faltou" com a resposta "não cobrar / não abater do pacote".
 *
 * Em "a cada sessão" ela não gera cobrança, e é só isso. No PACOTE ela PAUSA a sequência (doc 54):
 * continua pertencendo ao pacote e ao grupo de pagamento dele, mantém o número onde a falta
 * aconteceu, e a próxima sessão assume aquela posição — a regra de Desmarcou, Atestado e Prof.
 * desm., que foi o que o dono pediu.
 *
 * Até o doc 54 ela era TIRADA do pacote, e as duas coisas não são a mesma: fora do pacote a sessão
 * perdia o número (aparecia "—") e sumia do grupo de pagamento a que pertencia, que é a tabela
 * desorganizada que ele relatou.
 */
const faltouNaoConta = (s: SessaoDaCobranca) => s.status === "nao_realizada" && s.faltouConta === false;

/**
 * CORTESIA (doc 54): um atendimento do pacote que a terapeuta decidiu não cobrar.
 *
 * Ele PAUSA a sequência — deixa de ocupar uma posição, e quem vem depois assume o número que ele
 * teria — mas continua pertencendo ao pacote e ao grupo de pagamento dele. É a diferença para a
 * sessão extra gratuita (`extra: "grat"`), que acontece FORA do pacote: usá-la aqui produziria o
 * lançamento separado que o doc proíbe em letra ("não deverá ser lançada isoladamente").
 */
const ehCortesia = (s: SessaoDaCobranca) => s.cortesia === true;

/** Segura a posição sem ocupá-la: a falta não abatida e a cortesia (doc 54). */
const pausaASequencia = (s: SessaoDaCobranca) => faltouNaoConta(s) || ehCortesia(s);

/**
 * GRATUITO + "Faltou" + "Sim, transformar em sessão paga" = uma sessão AVULSA (doc 54).
 *
 * Marcá-la aqui, e não no banco, é de propósito: a janela promete que remarcar "Faltou" refaz a
 * escolha, e uma coluna gravada obrigaria a desfazer o efeito antigo em todo caminho que grava
 * status — o mesmo motivo pelo qual a sequência do pacote nunca é guardada. Derivado, o "Não"
 * desfaz sozinho.
 *
 * Só o Sim EXPLÍCITO vale. Falta antiga sem resposta (`null`) nunca gerou cobrança nenhuma, e
 * tratá-la como Sim criaria dívida retroativa em paciente que não paga.
 */
function marcarFaltaCobradaNoGratuito(ordenadas: Ordenada[], periodos: PeriodoDeVigencia[]): Ordenada[] {
  const avulsas = new Set<string>();
  for (const grupo of separarPorVigencia(ordenadas, periodos)) {
    if (grupo.periodo.formato !== "gratuito") continue;
    for (const s of grupo.sessoes) {
      if (!ehExtra(s) && s.status === "nao_realizada" && s.faltouConta === true) avulsas.add(s.id);
    }
  }
  if (!avulsas.size) return ordenadas;
  return ordenadas.map((s) => (avulsas.has(s.id) ? { ...s, extra: "avul" as const } : s));
}

/** Pertence à sequência do pacote? (Pertencer e OCUPAR posição são coisas diferentes — ver `pausa`.) */
function entraNoPacote(s: SessaoDaCobranca): boolean {
  if (ehExtra(s)) return false;
  if (s.sessionKind === "devolutiva") return !!s.abaterDoPacote;
  return true;
}

/** O dia `dia` do mês de `base`. Dia 31 em fevereiro vira o último dia do mês, não março. */
function diaDoMes(base: Date, dia: number, somaMeses = 0): Date {
  const ano = base.getFullYear();
  const mes = base.getMonth() + somaMeses;
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return new Date(ano, mes, Math.min(Math.max(1, Math.floor(dia)), ultimo));
}


function cobrancasDoPeriodo(periodo: PeriodoDeVigencia, sessoes: Ordenada[], e: EntradaDasCobrancas): Cobranca[] {
  const formato = periodo.formato;
  if (!cobra(formato)) return [];
  const reservaPreco = Number(e.valorDaSessao) || 0;
  const chavePeriodo = chaveDoDia(periodo.inicio);

  if (!usaPacote(formato)) {
    // A cada sessão: cada atendimento que ocupou posição é uma cobrança, no dia em que aconteceu.
    return sessoes
      .filter((s) => !ehExtra(s) && !devolutivaGratuita(s) && !STATUS_QUE_PAUSAM.has(s.status) && !pausaASequencia(s))
      .map((s) => ({
        chave: `sessao:${s.id}`,
        tipo: "sessao" as const,
        formato,
        valor: dinheiro(precoCobravel(e.precos, s.data, reservaPreco)),
        sessoes: 1,
        ids: [s.id],
        vencimento: s.data,
        competencia: s.data,
        posicao: "na_sessao" as const,
      }));
  }

  const tipoPacote = periodo.pacoteTipo === "fragmentado" ? "fragmentado" : "completo";
  const opcoesDaSequencia = { pacoteTipo: tipoPacote, tamanhos: e.tamanhos, tamanhoPacote: e.tamanhoPacote, tamanhosPorData: e.tamanhosPorData, vezesPorSemana: e.vezesPorSemana };
  const doPacote = sessoes.filter(entraNoPacote).map((s) => ({ id: s.id, date: s.data, status: s.status, repoeSessaoId: s.repoeSessaoId, pausa: pausaASequencia(s), cortesia: ehCortesia(s) }));
  const out: Cobranca[] = [];

  for (const seq of todasAsSequencias(doPacote, opcoesDaSequencia)) {
    const inicio = seq.comecouEm;
    if (!inicio) continue;
    const naAbertura = formato === "primeira_pacote";
    const competencia = naAbertura ? inicio : seq.fechouEm;
    const unitario = precoCobravel(e.precos, competencia ?? inicio, reservaPreco);
    const valor = dinheiro(unitario * seq.total);
    const ultimaData = doPacote.filter((s) => seq.ids.includes(s.id)).reduce<Date>((m, s) => (s.date > m ? s.date : m), inicio);

    const comum = {
      formato,
      sessoes: seq.total,
      ids: seq.ids,
      competencia,
    };

    /**
     * O PRIMEIRO vencimento nao pode cair antes da primeira sessao (dona, 18/09).
     *
     * Paciente que comeca dia 15 com pagamento combinado para o dia 10 nasceria devendo: a cobranca
     * vence cinco dias antes de existir atendimento. Nesse caso vale a data da primeira sessao.
     *
     * So o primeiro ciclo e ajustado — "proximos pagamentos considerar sempre a data de vencimento
     * definida no financeiro", nas palavras dela.
     */
    const primeiroCiclo = seq.sequencia === 0;
    const naoAntesDaPrimeira = (d: Date) => (primeiroCiclo && d.getTime() < inicio.getTime() ? inicio : d);

    if (formato === "quinzenal") {
      /**
       * A QUINZENA É DO CALENDÁRIO (dono, 17/09): do dia 01 ao 15, e do 16 ao fim do mês. Cada uma
       * cobra AS SESSÕES QUE CAÍRAM NELA, ao preço da sessão.
       *
       * Antes eram duas metades de valor igual, sem olhar data nenhuma — "não pode simplesmente
       * dividir o valor por 2", nas palavras dele. Era por isso que um paciente cujas sessões
       * começaram no dia 18 recebia uma cobrança vencendo dia 05: de uma quinzena vazia.
       *
       * Quinzena sem atendimento não vira cobrança. Uma linha de R$ 0,00 apareceria como "Pago"
       * sem ninguém ter pago — a conta trata falta zero como quitada.
       */
      const doPeriodo = doPacote
        .filter((s) => seq.ids.includes(s.id))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      /**
       * Como o pacote se parte em dois pagamentos (dona, 18/09, com o calendario dela inteiro):
       *
       * - **Completo**: por CONTAGEM — o pacote de quatro vira 2 + 2, o de oito vira 4 + 4. Era
       *   aqui que a tela saia torta: tres sessoes depois do dia 15 viravam um pagamento de tres e
       *   deixavam a quarta sozinha.
       * - **Fracionado**: pela quinzena do CALENDARIO (01-15 e 16-fim), como em #192 — no
       *   fracionado o mes ja e a unidade, e o exemplo dela confirma (outubro com 16, 23 e 30 e um
       *   pagamento so).
       */
      const metades =
        tipoPacote === "fragmentado"
          ? [
              { parte: 1 as const, ids: doPeriodo.filter((s) => s.date.getDate() <= 15) },
              { parte: 2 as const, ids: doPeriodo.filter((s) => s.date.getDate() > 15) },
            ]
          : (() => {
              const meio = Math.ceil(doPeriodo.length / 2);
              return [
                { parte: 1 as const, ids: doPeriodo.slice(0, meio) },
                { parte: 2 as const, ids: doPeriodo.slice(meio) },
              ];
            })();

      for (const metade of metades) {
        if (!metade.ids.length) continue;
        /**
         * A quinzena cobra AS SESSÕES QUE CAÍRAM NELA. A cortesia caiu nela e continua no grupo de
         * pagamento — é o que o doc 54 exige —, mas cobrá-la seria cobrar justamente o atendimento
         * que a terapeuta decidiu dar. Ela conta para o `ids`, nunca para o valor.
         */
        const cobraveis = metade.ids.filter((s) => !s.cortesia).length;
        if (!cobraveis) continue;
        /**
         * Doc 24 (dono, 09/10): cada quinzena vence na SUA data — a 1ª quinzena no 1º dia combinado,
         * a 2ª quinzena no 2º dia —, no mês da primeira sessão da quinzena. É a recorrência quinzenal
         * literal: paga dia 10 e dia 20 do mês. As duas datas são respeitadas desde a geração inicial;
         * antes o motor pegava "o próximo dia combinado a partir da sessão", e a 2ª quinzena, começando
         * depois do dia 20, pulava para o dia 10 do mês seguinte — ignorando a 2ª data.
         *
         * Isto SUBSTITUI a regra de 18/09 (não vencer antes da 1ª sessão): o dono escolheu dia 10/dia 20
         * do mês mesmo que a 2ª quinzena venha a vencer alguns dias antes das sessões dela.
         */
        const dataDaParte = metade.parte === 1 ? e.diaPagamento : (e.diaPagamento2 ?? e.diaPagamento);
        const primeira = metade.ids[0].date;
        const vencimento = dataDaParte ? diaDoMes(primeira, dataDaParte) : primeira;
        out.push({
          ...comum,
          sessoes: cobraveis,
          ids: metade.ids.map((s) => s.id),
          chave: `quinzena:${chavePeriodo}:${seq.sequencia}:${metade.parte}`,
          tipo: "quinzena",
          valor: dinheiro(unitario * cobraveis),
          vencimento,
          posicao: "antes",
          parte: metade.parte,
        });
      }
      continue;
    }

    const vencimento =
      formato === "mensal"
        ? e.diaPagamento
          ? naoAntesDaPrimeira(diaDoMes(inicio, e.diaPagamento))
          : inicio
        : formato === "primeira_pacote"
          ? inicio
          : seq.fechouEm ?? ultimaData;

    out.push({
      ...comum,
      chave: `pacote:${chavePeriodo}:${seq.sequencia}`,
      tipo: "pacote",
      valor,
      vencimento,
      posicao: formato === "ultima_pacote" ? "depois" : "antes",
    });
  }
  return out;
}

/** Todas as cobranças do paciente, em ordem de vencimento. */
export function cobrancasDoPaciente(e: EntradaDasCobrancas): Cobranca[] {
  const periodos = periodosDeVigencia(e.vigencias, e.reserva);
  const ordenadas = marcarFaltaCobradaNoGratuito(emOrdem(e.sessoes), periodos);
  const reservaPreco = Number(e.valorDaSessao) || 0;

  const out: Cobranca[] = [];

  // Extra: não olha o período. É "independente da definição do financeiro".
  for (const s of ordenadas) {
    if (s.extra !== "avul" || STATUS_QUE_PAUSAM.has(s.status)) continue;
    const informado = Number(s.valorExtra);
    const valor = Number.isFinite(informado) && informado >= 0 ? informado : precoCobravel(e.precos, s.data, reservaPreco);
    out.push({
      chave: `extra:${s.id}`,
      tipo: "extra",
      formato: "extra",
      valor: dinheiro(valor),
      sessoes: 1,
      ids: [s.id],
      vencimento: s.data,
      competencia: s.data,
      posicao: "na_sessao",
    });
  }

  for (const grupo of separarPorVigencia(ordenadas, periodos)) {
    out.push(...cobrancasDoPeriodo(grupo.periodo, grupo.sessoes, e));
  }

  // Doc 31: aplica o vencimento editado à mão por cima do calculado. Antes de ordenar, para que a
  // cobrança seja posicionada na guia pela data nova (é o que a terapeuta espera ao mudar o dia).
  if (e.vencimentos?.length) {
    const override = new Map(e.vencimentos.map((v) => [v.chave, emData(v.vencimento)] as const));
    for (const c of out) {
      const novo = override.get(c.chave);
      if (novo && !Number.isNaN(novo.getTime())) c.vencimento = novo;
    }
  }

  const quando = (c: Cobranca) => (c.vencimento ?? c.competencia)?.getTime() ?? 0;
  return out.sort((a, b) => quando(a) - quando(b) || a.chave.localeCompare(b.chave));
}

/**
 * O rótulo de cada sessão — `1/4`, `AVUL`, `GRAT`, `DEVOL` — pelo formato do período dela.
 *
 * Mapa em ordem de data. É a mesma varredura das cobranças, então a célula da agenda e a guia Geral
 * não conseguem mais discordar da Fechamento sobre qual sessão é qual.
 */
export function rotulosDasSessoes(e: EntradaDasCobrancas): Map<string, string> {
  const periodos = periodosDeVigencia(e.vigencias, e.reserva);
  const ordenadas = marcarFaltaCobradaNoGratuito(emOrdem(e.sessoes), periodos);
  const rotulos = new Map<string, string>(ordenadas.map((s) => [s.id, ""]));

  for (const grupo of separarPorVigencia(ordenadas, periodos)) {
    const { formato, pacoteTipo } = grupo.periodo;
    const posicoes = usaPacote(formato)
      ? posicoesDaSequencia(
          grupo.sessoes.filter(entraNoPacote).map((s) => ({ id: s.id, date: s.data, status: s.status, repoeSessaoId: s.repoeSessaoId, pausa: pausaASequencia(s) })),
          { pacoteTipo: pacoteTipo === "fragmentado" ? "fragmentado" : "completo", tamanhos: e.tamanhos, tamanhoPacote: e.tamanhoPacote, tamanhosPorData: e.tamanhosPorData, vezesPorSemana: e.vezesPorSemana },
        )
      : new Map();

    for (const s of grupo.sessoes) {
      if (s.extra === "avul") { rotulos.set(s.id, "AVUL"); continue; }
      if (s.extra === "grat") { rotulos.set(s.id, "GRAT"); continue; }
      if (formato === "sessao" && devolutivaGratuita(s)) { rotulos.set(s.id, "GRAT"); continue; }
      // Doc 54: a cortesia é GRAT na agenda e na guia Geral — é o que ela é, e o número que ela
      // teria passou para a sessão seguinte.
      if (ehCortesia(s)) { rotulos.set(s.id, "GRAT"); continue; }
      const p = posicoes.get(s.id);
      rotulos.set(
        s.id,
        codigoDaSessao({
          formato,
          tipo: s.sessionKind ?? "consulta",
          abateDoPacote: !!s.abaterDoPacote,
          posicao: p ? { index: p.index, total: p.total } : null,
        }),
      );
    }
  }
  return rotulos;
}
