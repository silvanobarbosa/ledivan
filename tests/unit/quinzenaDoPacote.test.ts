import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * COMO O QUINZENAL PARTE O PACOTE (documento de 18/09, com o calendário dela inteiro).
 *
 * Ela montou um caso completo — sessões toda sexta a partir de 16/10, R$ 100 a sessão, dias de
 * pagamento 10 e 20 — e escreveu o que espera ver. Dois achados saem daí:
 *
 * 1. **No pacote COMPLETO a divisão é por CONTAGEM**, não por quinzena de calendário: o pacote de
 *    quatro vira 2 + 2. Era aqui que a tela saía torta — as três primeiras caíam depois do dia 15 e
 *    viravam um pagamento de três sessões, deixando a quarta sozinha.
 * 2. **No FRACIONADO continua sendo a quinzena do calendário** (01–15 e 16–fim), como em #192 — e o
 *    exemplo dela confirma: outubro com 16, 23 e 30 é um pagamento só de R$ 300.
 *
 * E o vencimento de cada pagamento é **o próximo dia combinado (10 ou 20) a partir da primeira
 * sessão daquele grupo**. É essa regra que faz o primeiro pagamento cair em 20/10 — *"no dia 10 a
 * pessoa ainda não era paciente"*.
 */

const FEE = 100;
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
/** `mes` base zero: 9 = outubro. */
const sessao = (dia: number, mes: number): SessaoDaCobranca => ({
  id: `s${++n}-${mes + 1}-${dia}`,
  date: new Date(2026, mes, dia, 8, 0, 0),
  status: "realizada",
});

/** O calendário do documento: sextas de 16/10 a 04/12. */
const agenda = () => [
  sessao(16, 9), sessao(23, 9), sessao(30, 9),
  sessao(6, 10), sessao(13, 10), sessao(20, 10), sessao(27, 10),
  sessao(4, 11),
];

const cobrar = (pacoteTipo: "completo" | "fragmentado") =>
  cobrancasDoPaciente({
    vigencias: [],
    reserva: { formato: "quinzenal", pacoteTipo },
    precos,
    valorDaSessao: FEE,
    tamanhos: [],
    diaPagamento: 10,
    diaPagamento2: 20,
    sessoes: agenda(),
  });

/** "dd/mm · N sessões · R$ V" de cada cobrança. */
const resumo = (cs: ReturnType<typeof cobrar>) =>
  cs.map((c) => {
    const v = c.vencimento!;
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")} · ${c.sessoes} · ${c.valor}`;
  });

describe("pacote completo — o pacote de quatro vira 2 + 2", () => {
  it("cada pagamento cobre duas sessões, no valor das duas", () => {
    expect(resumo(cobrar("completo"))).toEqual([
      "20/10 · 2 · 200", // 16/10 e 23/10
      "10/11 · 2 · 200", // 30/10 e 06/11
      "20/11 · 2 · 200", // 13/11 e 20/11
      "10/12 · 2 · 200", // 27/11 e 04/12
    ]);
  });

  it("o primeiro vence em 20/10, não em 10/10 — a pessoa ainda não era paciente no dia 10", () => {
    expect(resumo(cobrar("completo"))[0].startsWith("20/10")).toBe(true);
  });

  it("cada cobrança carrega as sessões dela, sem repetir nenhuma", () => {
    const c = cobrar("completo");
    // O id carrega a data (o prefixo e um contador que corre entre os casos, entao so a data vale).
    const datas = (ids?: string[]) => (ids ?? []).map((i) => i.split("-").slice(1).join("/"));
    expect(datas(c[0].ids)).toEqual(["10/16", "10/23"]);
    expect(datas(c[1].ids)).toEqual(["10/30", "11/6"]);
    const todos = c.flatMap((x) => x.ids ?? []);
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe("pacote fracionado — a quinzena do calendário, como em #192", () => {
  it("outubro com três sessões depois do dia 15 é UM pagamento de R$ 300", () => {
    expect(resumo(cobrar("fragmentado"))[0]).toBe("20/10 · 3 · 300");
  });

  it("novembro com quatro reparte 2 e 2, nas duas quinzenas", () => {
    expect(resumo(cobrar("fragmentado")).slice(1, 3)).toEqual([
      "10/11 · 2 · 200", // 06 e 13 de novembro
      "20/11 · 2 · 200", // 20 e 27 de novembro
    ]);
  });
});

describe("o vencimento é o próximo dia combinado a partir da primeira sessão do grupo", () => {
  const venceEm = (dias: { diaPagamento: number; diaPagamento2?: number }, sessoes: SessaoDaCobranca[]) =>
    cobrancasDoPaciente({
      vigencias: [],
      reserva: { formato: "quinzenal", pacoteTipo: "completo" },
      precos,
      valorDaSessao: FEE,
      tamanhos: [],
      ...dias,
      sessoes,
    }).map((c) => `${String(c.vencimento!.getDate()).padStart(2, "0")}/${String(c.vencimento!.getMonth() + 1).padStart(2, "0")}`);

  it("sessão no dia do vencimento vence no MESMO dia", () => {
    // Primeira sessão em 20/11: o dia 20 conta, não empurra para dezembro.
    const ss = [sessao(20, 10), sessao(27, 10)];
    expect(venceEm({ diaPagamento: 10, diaPagamento2: 20 }, ss)[0]).toBe("20/11");
  });

  it("passando dos dois dias, vai para o primeiro do mês seguinte", () => {
    const ss = [sessao(27, 10), sessao(4, 11)];
    expect(venceEm({ diaPagamento: 10, diaPagamento2: 20 }, ss)[0]).toBe("10/12");
  });

  it("com um dia só combinado, é sempre ele", () => {
    const ss = [sessao(16, 9), sessao(23, 9)];
    expect(venceEm({ diaPagamento: 5 }, ss)[0]).toBe("05/11");
  });
});
