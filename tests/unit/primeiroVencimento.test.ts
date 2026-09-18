import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O PRIMEIRO VENCIMENTO NÃO PODE CAIR ANTES DA PRIMEIRA SESSÃO (documento de 18/09).
 *
 * A dona: *"Se a data de vencimento escolhida for anterior à data do primeiro agendamento, o
 * sistema deverá considerar, para o primeiro agendamento, a data do primeiro agendamento."*
 *
 * O caso dela: paciente começa em 15/09 e o dia de pagamento combinado é 10. Cobrar com vencimento
 * em 10/09 põe a cobrança em atraso no instante em que nasce — o paciente estaria devendo por um
 * atendimento que ainda não tinha acontecido.
 *
 * Só o PRIMEIRO ciclo é ajustado. Os seguintes usam o dia combinado, sempre.
 */

const FEE = 100;
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
/** `mes` base zero: 8 = setembro. */
const sessao = (dia: number, mes = 8): SessaoDaCobranca => ({
  id: `s${++n}`,
  date: new Date(2026, mes, dia, 10, 0, 0),
  status: "realizada",
});

const cobrar = (formato: string, sessoes: SessaoDaCobranca[], extra: Record<string, unknown> = {}) =>
  cobrancasDoPaciente({
    vigencias: [],
    reserva: { formato, pacoteTipo: "completo" },
    precos,
    valorDaSessao: FEE,
    tamanhos: [],
    diaPagamento: 10,
    ...extra,
    sessoes,
  });

/** "dd/mm" de cada vencimento, na ordem. */
const vencimentos = (cs: ReturnType<typeof cobrar>) =>
  cs.map((c) => (c.vencimento ? `${String(c.vencimento.getDate()).padStart(2, "0")}/${String(c.vencimento.getMonth() + 1).padStart(2, "0")}` : "—"));

describe("mensal", () => {
  it("vencimento ANTERIOR à primeira sessão vira a data da primeira sessão", () => {
    // Exemplo do documento: começa 15/09, dia de pagamento 10 → o primeiro vence 15/09.
    const mes1 = [15, 22, 29].map((d) => sessao(d)).concat(sessao(6, 9));
    expect(vencimentos(cobrar("mensal", mes1))[0]).toBe("15/09");
  });

  it("vencimento POSTERIOR à primeira sessão é usado como está", () => {
    // O outro exemplo dela: dia de pagamento 20 → vence 20/09 mesmo.
    const mes1 = [15, 22, 29].map((d) => sessao(d)).concat(sessao(6, 9));
    expect(vencimentos(cobrar("mensal", mes1, { diaPagamento: 20 }))[0]).toBe("20/09");
  });

  it("vencimento no MESMO dia da primeira sessão é usado como está", () => {
    const mes1 = [15, 22, 29].map((d) => sessao(d)).concat(sessao(6, 9));
    expect(vencimentos(cobrar("mensal", mes1, { diaPagamento: 15 }))[0]).toBe("15/09");
  });

  it("os pacotes SEGUINTES voltam a usar o dia combinado", () => {
    // Dois pacotes de quatro. O primeiro é ajustado; o segundo vence no dia 10, como combinado.
    const sessoes = [15, 22, 29].map((d) => sessao(d))
      .concat([6, 13, 20, 27].map((d) => sessao(d, 9)))
      .concat(sessao(3, 10));
    expect(vencimentos(cobrar("mensal", sessoes))).toEqual(["15/09", "10/10"]);
  });
});

describe("quinzenal", () => {
  it("a primeira quinzena não vence antes da primeira sessão", () => {
    // Começa 18/09 (segunda quinzena). Dias de pagamento 10 e 20: o 20 vale, mas se a primeira
    // cobrança fosse a da 1ª quinzena ela venceria dia 10, antes de existir atendimento.
    const c = cobrar("quinzenal", [sessao(18), sessao(25)], { diaPagamento: 10, diaPagamento2: 20 });
    expect(vencimentos(c)).toEqual(["20/09"]);
  });

  it("com sessões nas duas quinzenas, só a primeira cobrança é ajustada", () => {
    // Começa 12/09 (primeira quinzena) e o dia combinado é 10 — antes da primeira sessão.
    const c = cobrar("quinzenal", [sessao(12), sessao(19), sessao(26)], { diaPagamento: 10, diaPagamento2: 20 });
    expect(vencimentos(c)).toEqual(["12/09", "20/09"]);
  });
});

describe("o que não muda", () => {
  it("a cada sessão continua vencendo na própria sessão", () => {
    const c = cobrar("sessao", [sessao(15), sessao(22)]);
    expect(vencimentos(c)).toEqual(["15/09", "22/09"]);
  });

  it("primeira do pacote continua vencendo na primeira sessão", () => {
    const c = cobrar("primeira_pacote", [15, 22, 29].map((d) => sessao(d)).concat(sessao(6, 9)));
    expect(vencimentos(c)).toEqual(["15/09"]);
  });

  it("última do pacote continua vencendo na última sessão", () => {
    const c = cobrar("ultima_pacote", [15, 22, 29].map((d) => sessao(d)).concat(sessao(6, 9)));
    expect(vencimentos(c)).toEqual(["06/10"]);
  });
});
