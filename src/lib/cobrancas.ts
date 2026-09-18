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
import { precoNaData, type PrecoVigente } from "./preco";
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
  /** Sessão extra, FORA da sequência: `avul` cobra à parte, `grat` não cobra. */
  extra?: "avul" | "grat" | string | null;
  /** O valor informado da extra avulsa. */
  valorExtra?: number | string | null;
  /** Qual sessao desmarcada esta aqui repoe (documento de 17/09). Reposicao ocupa vaga, nao cria. */
  repoeSessaoId?: string | null;
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
  /** 1 ou 2 sessões por semana (cadastro). Define o tamanho do pacote fechado: 4 ou 8. */
  vezesPorSemana?: number;
  diaPagamento?: number | null;
  diaPagamento2?: number | null;
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

/** Ocupa posição na sequência do pacote? */
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
      .filter((s) => !ehExtra(s) && !devolutivaGratuita(s) && !STATUS_QUE_PAUSAM.has(s.status))
      .map((s) => ({
        chave: `sessao:${s.id}`,
        tipo: "sessao" as const,
        formato,
        valor: dinheiro(precoNaData(e.precos, s.data, reservaPreco)),
        sessoes: 1,
        ids: [s.id],
        vencimento: s.data,
        competencia: s.data,
        posicao: "na_sessao" as const,
      }));
  }

  const tipoPacote = periodo.pacoteTipo === "fragmentado" ? "fragmentado" : "completo";
  const opcoesDaSequencia = { pacoteTipo: tipoPacote, tamanhos: e.tamanhos, vezesPorSemana: e.vezesPorSemana };
  const doPacote = sessoes.filter(entraNoPacote).map((s) => ({ id: s.id, date: s.data, status: s.status, repoeSessaoId: s.repoeSessaoId }));
  const out: Cobranca[] = [];

  for (const seq of todasAsSequencias(doPacote, opcoesDaSequencia)) {
    const inicio = seq.comecouEm;
    if (!inicio) continue;
    const naAbertura = formato === "primeira_pacote";
    const competencia = naAbertura ? inicio : seq.fechouEm;
    const unitario = precoNaData(e.precos, competencia ?? inicio, reservaPreco);
    const valor = dinheiro(unitario * seq.total);
    const ultimaData = doPacote.filter((s) => seq.ids.includes(s.id)).reduce<Date>((m, s) => (s.date > m ? s.date : m), inicio);

    const comum = {
      formato,
      sessoes: seq.total,
      ids: seq.ids,
      competencia,
    };

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
      const doPeriodo = doPacote.filter((s) => seq.ids.includes(s.id));
      const metades = [
        { parte: 1 as const, ids: doPeriodo.filter((s) => s.date.getDate() <= 15) },
        { parte: 2 as const, ids: doPeriodo.filter((s) => s.date.getDate() > 15) },
      ];

      const d1 = e.diaPagamento ?? inicio.getDate();
      const d2 = e.diaPagamento2 ?? d1;
      // Segundo dia antes do primeiro no calendário quer dizer o mês seguinte.
      const vencimentos = { 1: diaDoMes(inicio, d1), 2: diaDoMes(inicio, d2, d2 < d1 ? 1 : 0) };

      for (const metade of metades) {
        if (!metade.ids.length) continue;
        out.push({
          ...comum,
          sessoes: metade.ids.length,
          ids: metade.ids.map((s) => s.id),
          chave: `quinzena:${chavePeriodo}:${seq.sequencia}:${metade.parte}`,
          tipo: "quinzena",
          valor: dinheiro(unitario * metade.ids.length),
          vencimento: vencimentos[metade.parte],
          posicao: "antes",
          parte: metade.parte,
        });
      }
      continue;
    }

    const vencimento =
      formato === "mensal"
        ? e.diaPagamento
          ? diaDoMes(inicio, e.diaPagamento)
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
  const ordenadas = emOrdem(e.sessoes);
  const periodos = periodosDeVigencia(e.vigencias, e.reserva);
  const reservaPreco = Number(e.valorDaSessao) || 0;

  const out: Cobranca[] = [];

  // Extra: não olha o período. É "independente da definição do financeiro".
  for (const s of ordenadas) {
    if (s.extra !== "avul" || STATUS_QUE_PAUSAM.has(s.status)) continue;
    const informado = Number(s.valorExtra);
    const valor = Number.isFinite(informado) && informado >= 0 ? informado : precoNaData(e.precos, s.data, reservaPreco);
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
  const ordenadas = emOrdem(e.sessoes);
  const periodos = periodosDeVigencia(e.vigencias, e.reserva);
  const rotulos = new Map<string, string>(ordenadas.map((s) => [s.id, ""]));

  for (const grupo of separarPorVigencia(ordenadas, periodos)) {
    const { formato, pacoteTipo } = grupo.periodo;
    const posicoes = usaPacote(formato)
      ? posicoesDaSequencia(
          grupo.sessoes.filter(entraNoPacote).map((s) => ({ id: s.id, date: s.data, status: s.status, repoeSessaoId: s.repoeSessaoId })),
          { pacoteTipo: pacoteTipo === "fragmentado" ? "fragmentado" : "completo", tamanhos: e.tamanhos, vezesPorSemana: e.vezesPorSemana },
        )
      : new Map();

    for (const s of grupo.sessoes) {
      if (s.extra === "avul") { rotulos.set(s.id, "AVUL"); continue; }
      if (s.extra === "grat") { rotulos.set(s.id, "GRAT"); continue; }
      if (formato === "sessao" && devolutivaGratuita(s)) { rotulos.set(s.id, "GRAT"); continue; }
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
