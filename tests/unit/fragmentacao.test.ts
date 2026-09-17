import { describe, expect, it } from "vitest";
import { posicoesDaSequencia, todasAsSequencias } from "@/lib/sequenciaPacote";
import { cobrancasDoPaciente } from "@/lib/cobrancas";

/**
 * FRAGMENTAÇÃO — os quatro casos do documento de 17/09, escritos ANTES do código.
 *
 * O pacote fragmentado trata cada mês como uma sequência própria. O que estava faltando era o que
 * acontece quando uma sessão do mês não acontece:
 *
 * - **F1** Desmarcou sem reposição no mês: o denominador NÃO encolhe. A vaga é ocupada pela próxima
 *   sessão real, que pode ser do mês seguinte — ela atravessa mantendo o número, e o mês seguinte
 *   recomeça a partir da próxima.
 * - **F2** Reposição no mesmo mês: a inserida ocupa a posição da desmarcada. Nada muda adiante.
 * - **F3** Reposição da última do mês: igual à F2.
 * - **F4** Sessão não adicionada à sequência: fica fora (AVUL/GRAT) — entregue na onda 5.
 *
 * **O invariante, e a razão de tudo isto:** a sessão que atravessa JÁ FOI PAGA no mês dela. Ela não
 * pode ser cobrada de novo no mês em que for realizada — "sem perder atendimentos e sem gerar
 * cobranças duplicadas".
 *
 * O que torna F1 e F2 distinguíveis é o vínculo de reposição (`repoeSessaoId`): sem ele, os dois
 * casos chegam aqui como dados idênticos — um mês com uma desmarcada e uma sessão a mais — e pedem
 * denominadores diferentes. Uma sessão de reposição não cria vaga: ela ocupa a que ficou aberta.
 */

const dia = (d: number, mes: number, status = "realizada", extra: Record<string, unknown> = {}) => ({
  id: `${mes}-${d}`,
  date: new Date(2026, mes - 1, d, 9),
  status,
  ...extra,
});

const frag = { pacoteTipo: "fragmentado" as const };

/** "id=index/total" por sessão, na ordem — o que a célula da agenda escreve. */
const mapa = (sessoes: Parameters<typeof posicoesDaSequencia>[0]) => {
  const p = posicoesDaSequencia(sessoes, frag);
  return sessoes.map((s) => {
    const x = p.get(s.id)!;
    return `${s.id}=${x.index}/${x.total}`;
  });
};

/** A qual sequência cada sessão pertence — é o que decide em qual mês ela é cobrada. */
const sequencias = (sessoes: Parameters<typeof posicoesDaSequencia>[0]) => {
  const p = posicoesDaSequencia(sessoes, frag);
  return sessoes.map((s) => `${s.id}#${p.get(s.id)!.sequencia}`);
};

describe("F1 — desmarcou sem reposição no mês", () => {
  // Setembro contratou três (05, 12, 19) e a primeira foi desmarcada. Outubro tem quatro.
  const sessoes = [
    dia(5, 9, "cancelada"), dia(12, 9), dia(19, 9),
    dia(3, 10), dia(10, 10), dia(17, 10), dia(24, 10),
  ];

  it("o denominador de setembro não encolhe: continua /3", () => {
    expect(mapa(sessoes).slice(0, 3)).toEqual(["9-5=1/3", "9-12=1/3", "9-19=2/3"]);
  });

  it("a última vaga de setembro é ocupada por uma sessão de outubro, que atravessa como 3/3", () => {
    expect(mapa(sessoes)[3]).toBe("10-3=3/3");
  });

  it("outubro recomeça na próxima, com o que sobrou dele", () => {
    expect(mapa(sessoes).slice(4)).toEqual(["10-10=1/3", "10-17=2/3", "10-24=3/3"]);
  });

  it("a sessão que atravessa pertence à sequência de SETEMBRO, não à de outubro", () => {
    expect(sequencias(sessoes)).toEqual([
      "9-5#0", "9-12#0", "9-19#0", "10-3#0",
      "10-10#1", "10-17#1", "10-24#1",
    ]);
  });

  it("dois meses, duas sequências fechadas — nenhuma sessão em duas", () => {
    const fechadas = todasAsSequencias(sessoes, frag);
    expect(fechadas.map((f) => f.total)).toEqual([3, 3]);
    const todosOsIds = fechadas.flatMap((f) => f.ids);
    expect(new Set(todosOsIds).size).toBe(todosOsIds.length);
  });
});

describe("F1 — o invariante: a sessão que atravessa não é cobrada duas vezes", () => {
  const sessoes = [
    dia(5, 9, "cancelada"), dia(12, 9), dia(19, 9),
    dia(3, 10), dia(10, 10), dia(17, 10), dia(24, 10),
  ];

  const cobrancas = () =>
    cobrancasDoPaciente({
      vigencias: [{ formato: "mensal", pacoteTipo: "fragmentado", desde: new Date(2026, 0, 1), criadoEm: new Date(2026, 0, 1) }],
      reserva: { formato: "mensal", pacoteTipo: "fragmentado" },
      precos: [{ valor: 130, desde: new Date(2026, 0, 1) }],
      sessoes,
      hoje: new Date(2026, 10, 1, 12),
    });

  it("cada sessão entra em UMA cobrança só", () => {
    const ids = cobrancas().flatMap((c) => c.ids ?? []);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("setembro cobra as três que ele contratou, contando a que atravessou", () => {
    expect(cobrancas().map((c) => [c.sessoes, c.valor])).toEqual([
      [3, 390],
      [3, 390],
    ]);
  });
});

describe("F2 — reposição no mesmo mês", () => {
  // A de 05 foi desmarcada e reposta no dia 26, ainda em setembro.
  const sessoes = [
    dia(5, 9, "cancelada"), dia(12, 9), dia(19, 9), dia(26, 9, "realizada", { repoeSessaoId: "9-5" }),
    dia(3, 10), dia(10, 10), dia(17, 10), dia(24, 10),
  ];

  it("a reposição ocupa a posição da desmarcada — setembro continua /3, não vira /4", () => {
    expect(mapa(sessoes).slice(0, 4)).toEqual(["9-5=1/3", "9-12=1/3", "9-19=2/3", "9-26=3/3"]);
  });

  it("nada muda no mês seguinte: outubro segue com os quatro dele", () => {
    expect(mapa(sessoes).slice(4)).toEqual(["10-3=1/4", "10-10=2/4", "10-17=3/4", "10-24=4/4"]);
  });

  it("nenhuma sessão de outubro é puxada para setembro", () => {
    expect(sequencias(sessoes).slice(4).every((x) => x.endsWith("#1"))).toBe(true);
  });
});

describe("F3 — reposição da ÚLTIMA do mês, ainda no mês", () => {
  // A de 19 (última de setembro) foi desmarcada e reposta no dia 26.
  const sessoes = [
    dia(5, 9), dia(12, 9), dia(19, 9, "cancelada"), dia(26, 9, "realizada", { repoeSessaoId: "9-19" }),
    dia(3, 10), dia(10, 10), dia(17, 10), dia(24, 10),
  ];

  it("igual à F2: a reposição ocupa a posição, setembro fecha em /3", () => {
    expect(mapa(sessoes).slice(0, 4)).toEqual(["9-5=1/3", "9-12=2/3", "9-19=3/3", "9-26=3/3"]);
  });

  it("outubro segue intacto", () => {
    expect(mapa(sessoes).slice(4)).toEqual(["10-3=1/4", "10-10=2/4", "10-17=3/4", "10-24=4/4"]);
  });
});

describe("a reposição vinda no mês seguinte", () => {
  // Desmarcou em setembro e repôs em 03/10: a reposição fecha setembro, e outubro fica com os seus.
  const sessoes = [
    dia(5, 9, "cancelada"), dia(12, 9), dia(19, 9),
    dia(3, 10, "realizada", { repoeSessaoId: "9-5" }), dia(10, 10), dia(17, 10), dia(24, 10),
  ];

  it("a reposição fecha setembro como 3/3", () => {
    expect(mapa(sessoes)[3]).toBe("10-3=3/3");
  });

  it("outubro não perde uma das suas: continua /3 com as três que lhe restam", () => {
    expect(mapa(sessoes).slice(4)).toEqual(["10-10=1/3", "10-17=2/3", "10-24=3/3"]);
  });
});

describe("o mês sem sobressalto continua como era", () => {
  it("setembro com três e outubro com quatro, tudo realizado", () => {
    const sessoes = [dia(1, 9), dia(8, 9), dia(15, 9), dia(6, 10), dia(13, 10), dia(20, 10), dia(27, 10)];
    expect(mapa(sessoes)).toEqual([
      "9-1=1/3", "9-8=2/3", "9-15=3/3",
      "10-6=1/4", "10-13=2/4", "10-20=3/4", "10-27=4/4",
    ]);
  });
});
