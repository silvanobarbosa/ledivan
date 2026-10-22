import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, rotulosDasSessoes, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * CORTESIA: "Este atendimento será uma cortesia" (doc 54, item 03).
 *
 * Um atendimento do pacote que a terapeuta decide não cobrar. Ele não é uma sessão extra: continua
 * sendo daquele pacote, no grupo de pagamento daquele pacote — "evitando confusões na organização e
 * no controle financeiro", nas palavras do doc. O que ele deixa de fazer é OCUPAR uma posição na
 * sequência: quem vem depois assume o número que ele teria.
 *
 * É por isso que `extra: "grat"` não serve. A sessão extra gratuita acontece FORA do pacote, e sai
 * do grupo de pagamento — exatamente o lançamento separado que o doc proíbe.
 *
 * Exemplos do dono, pacote completo de 4:
 *   cortesia na 1ª → GRAT, 1/4, 2/4, 3/4, 4/4
 *   cortesia na 3ª → 1/4, 2/4, GRAT, 3/4, 4/4
 */

const FEE = 200;
const SEGUNDAS = [5, 12, 19, 26].map((d) => new Date(2024, 7, d, 11, 0))
  .concat([2, 9].map((d) => new Date(2024, 8, d, 11, 0)));

const pacote = (cortesiaEm: number | null, formato = "mensal") => {
  const sessoes: SessaoDaCobranca[] = SEGUNDAS.map((date, i) => ({
    id: `s${i}`,
    date,
    status: "realizada",
    ...(i === cortesiaEm ? { cortesia: true } : {}),
  }));
  return {
    vigencias: [],
    reserva: { formato, pacoteTipo: "completo" },
    precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
    valorDaSessao: FEE,
    tamanhos: [],
    tamanhoPacote: 4,
    vezesPorSemana: 1,
    diaPagamento: 10,
    diaPagamento2: 20,
    sessoes,
  };
};

const rotulos = (cortesiaEm: number | null, formato?: string) => {
  const e = pacote(cortesiaEm, formato);
  const m = rotulosDasSessoes(e);
  return e.sessoes.map((s) => m.get(s.id));
};

describe("doc 54 — cortesia dentro do pacote", () => {
  it("sem cortesia, a sequência é a de sempre", () => {
    expect(rotulos(null)).toEqual(["1/4", "2/4", "3/4", "4/4", "1/4", "2/4"]);
  });

  it("cortesia na 1ª: ela vira GRAT e a seguinte assume o 1/4", () => {
    expect(rotulos(0)).toEqual(["GRAT", "1/4", "2/4", "3/4", "4/4", "1/4"]);
  });

  it("cortesia na 3ª: as duas antes dela não mudam, a seguinte assume o 3/4", () => {
    expect(rotulos(2)).toEqual(["1/4", "2/4", "GRAT", "3/4", "4/4", "1/4"]);
  });

  it("a cortesia continua no grupo de pagamento do pacote dela — nada de lançamento separado", () => {
    const primeira = cobrancasDoPaciente(pacote(0))[0];
    expect(primeira.ids).toContain("s0");
    expect(primeira.tipo).toBe("pacote");
  });

  it("o pacote continua cobrando as 4 sessões contratadas, nem mais nem menos", () => {
    expect(cobrancasDoPaciente(pacote(0))[0].valor).toBe(FEE * 4);
    expect(cobrancasDoPaciente(pacote(2))[0].valor).toBe(FEE * 4);
  });

  it("quinzenal: a cortesia entra no grupo, mas não é cobrada na quinzena", () => {
    // A quinzena cobra AS SESSÕES QUE CAÍRAM NELA. Contar a cortesia faria a terapeuta cobrar
    // justamente o atendimento que ela decidiu dar. Pausando, o pacote passa a abranger cinco
    // sessões — as quatro contratadas mais a de cortesia —, e as duas quinzenas somadas continuam
    // cobrando quatro.
    const c = cobrancasDoPaciente(pacote(0, "quinzenal"));
    const doPacote = c.filter((x) => x.ids.some((id) => ["s0", "s1", "s2", "s3", "s4"].includes(id)));
    expect(doPacote.flatMap((x) => x.ids)).toContain("s0");
    expect(doPacote.reduce((a, x) => a + x.valor, 0)).toBe(FEE * 4);
    expect(doPacote.reduce((a, x) => a + x.sessoes, 0)).toBe(4);
  });
});
