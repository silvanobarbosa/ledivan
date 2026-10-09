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
  it("cada pagamento cobre duas sessões; 1ª quinzena no dia 10, 2ª no dia 20 do mês (doc 24)", () => {
    expect(resumo(cobrar("completo"))).toEqual([
      "10/10 · 2 · 200", // 16/10 e 23/10 — 1ª quinzena do pacote → dia 10
      "20/10 · 2 · 200", // 30/10 e 06/11 — 2ª quinzena → dia 20
      "10/11 · 2 · 200", // 13/11 e 20/11 — 1ª quinzena do 2º pacote → dia 10
      "20/11 · 2 · 200", // 27/11 e 04/12 — 2ª quinzena → dia 20
    ]);
  });

  it("doc 24: as DUAS datas aparecem — 1ª quinzena no dia 10, 2ª no dia 20 (não só o dia 10)", () => {
    const r = resumo(cobrar("completo"));
    expect(r[0].startsWith("10/10")).toBe(true);
    expect(r[1].startsWith("20/10")).toBe(true);
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

describe("cada quinzena vence na SUA data (dia 10 / dia 20), no mês da sessão (doc 24)", () => {
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

  it("1ª quinzena usa o dia 10; 2ª quinzena usa o dia 20 — no mês da primeira sessão de cada uma", () => {
    const ss = [sessao(20, 10), sessao(27, 10)]; // 20/11 e 27/11, no mesmo pacote (2+2 → 1+1)
    expect(venceEm({ diaPagamento: 10, diaPagamento2: 20 }, ss)).toEqual(["10/11", "20/11"]);
  });

  it("a 2ª quinzena fica no dia 20 do mês dela mesmo que as sessões sejam depois do dia 20", () => {
    // Foto do doc 24: 2ª quinzena começa em 24/10 (depois do dia 20) → vence 20/10, não 10/11.
    const ss = [sessao(10, 9), sessao(17, 9), sessao(24, 9), sessao(31, 9)]; // out 10,17,24,31
    expect(venceEm({ diaPagamento: 10, diaPagamento2: 20 }, ss)).toEqual(["10/10", "20/10"]);
  });

  it("com um dia só combinado, as duas quinzenas caem nele (no mês de cada uma)", () => {
    const ss = [sessao(16, 9), sessao(23, 9)]; // 16/10 e 23/10
    expect(venceEm({ diaPagamento: 5 }, ss)).toEqual(["05/10", "05/10"]);
  });
});

/**
 * #18 — DUAS sessões na quinzena cobram pelas DUAS, não por uma.
 *
 * O dono relatou ver R$ 65 (uma sessão) onde deveria ver R$ 130 (duas) num quinzenal fragmentado
 * de duas sessões por quinzena. A conta já é `preço da sessão × nº de sessões da quinzena` — nunca
 * "metade do pacote" —, então o valor acompanha quantas sessões caíram ali. Este bloco TRANCA essa
 * garantia; se a tela mostrar 65, a causa é o DADO (preço da sessão cadastrado como metade, ou as
 * duas sessões caindo em quinzenas diferentes do calendário), não o motor.
 */
describe("#18 — duas sessões na mesma quinzena cobram as duas", () => {
  const umMes = (pacoteTipo: "completo" | "fragmentado", feePorSessao: number) =>
    cobrancasDoPaciente({
      vigencias: [],
      reserva: { formato: "quinzenal", pacoteTipo },
      precos: [{ valor: feePorSessao, desde: new Date(2026, 0, 1) }],
      valorDaSessao: feePorSessao,
      tamanhos: [],
      diaPagamento: 10,
      diaPagamento2: 20,
      // Semanal: duas sessões na 1ª quinzena (02 e 09) e duas na 2ª (16 e 23) de outubro.
      sessoes: [sessao(2, 9), sessao(9, 9), sessao(16, 9), sessao(23, 9)],
    });

  it("fragmentado: cada quinzena com duas sessões a R$ 65 cobra R$ 130, não R$ 65", () => {
    const cs = umMes("fragmentado", 65);
    expect(cs.map((c) => [c.sessoes, c.valor])).toEqual([
      [2, 130], // 02 e 09 (01–15)
      [2, 130], // 16 e 23 (16–fim)
    ]);
  });

  it("o valor é preço × nº de sessões: a R$ 100 as mesmas duas sessões dão R$ 200", () => {
    const cs = umMes("fragmentado", 100);
    expect(cs.map((c) => c.valor)).toEqual([200, 200]);
  });
});
