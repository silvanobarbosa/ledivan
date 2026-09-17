import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * A QUINZENA É DO CALENDÁRIO — os exemplos do documento de 17/09, escritos antes do código.
 *
 * O dono: *"Sempre calcular do dia 01 ao dia 15 e dia 15 ao dia 30. Não pode simplesmente dividir o
 * valor por 2."*
 *
 * Até aqui o quinzenal não tinha quinzena nenhuma: partia o pacote em duas metades de valor igual e
 * escolhia dois vencimentos. Por isso um paciente cujas sessões começaram no dia 18 recebia uma
 * cobrança vencendo dia 05 — de uma quinzena em que não houve atendimento.
 *
 * Agora cada quinzena cobra **as sessões que caíram nela**, ao preço da sessão.
 */

const FEE = 115; // o valor do exemplo do dono
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
/** `mes` é base zero, como no `Date`: 8 = setembro. */
const sessao = (dia: number, mes = 8): SessaoDaCobranca => ({
  id: `s${++n}-${mes + 1}-${dia}`,
  date: new Date(2026, mes, dia, 10, 0, 0),
  status: "realizada",
});

/** Quinzenal fragmentado: cada mês é a sua própria sequência — o caso do documento. */
const quinzenal = (sessoes: SessaoDaCobranca[]) =>
  cobrancasDoPaciente({
    vigencias: [],
    reserva: { formato: "quinzenal", pacoteTipo: "fragmentado" },
    precos,
    valorDaSessao: FEE,
    tamanhos: [],
    diaPagamento: 5,
    diaPagamento2: 20,
    sessoes,
  });

describe("o mês em que as sessões começam no meio", () => {
  // O caso relatado: as sessões começaram em 18/09, e o sistema cobrava algo vencendo 05/09.
  const setembro = [sessao(18), sessao(25)];

  it("a quinzena sem atendimento não vira cobrança", () => {
    expect(quinzenal(setembro)).toHaveLength(1);
  });

  it("a segunda quinzena cobra as duas sessões inteiras, não metade do mês", () => {
    expect(quinzenal(setembro).map((c) => [c.sessoes, c.valor])).toEqual([[2, 230]]);
  });

  it("e vence no dia da SEGUNDA quinzena", () => {
    expect(quinzenal(setembro)[0].vencimento?.getDate()).toBe(20);
  });
});

describe("o mês cheio: 5 sessões, 2 na primeira quinzena e 3 na segunda", () => {
  // O segundo exemplo do dono: R$ 230,00 e R$ 345,00 — e não R$ 287,50 duas vezes.
  const outubro = [sessao(2, 9), sessao(9, 9), sessao(16, 9), sessao(23, 9), sessao(30, 9)];

  it("cada quinzena cobra o que caiu nela", () => {
    expect(quinzenal(outubro).map((c) => [c.sessoes, c.valor])).toEqual([
      [2, 230],
      [3, 345],
    ]);
  });

  it("a soma das duas é o mês inteiro", () => {
    expect(quinzenal(outubro).reduce((t, c) => t + c.valor, 0)).toBe(5 * FEE);
  });

  it("cada quinzena vence no seu dia", () => {
    expect(quinzenal(outubro).map((c) => c.vencimento?.getDate())).toEqual([5, 20]);
  });

  it("cada cobrança carrega as sessões dela — nenhuma sessão em duas", () => {
    const [q1, q2] = quinzenal(outubro);
    expect(q1.ids).toEqual(["s3-10-2", "s4-10-9"]);
    expect(q2.ids).toEqual(["s5-10-16", "s6-10-23", "s7-10-30"]);
  });
});

describe("o dia 15 e o dia 16", () => {
  it("dia 15 é primeira quinzena; dia 16 é segunda", () => {
    const c = quinzenal([sessao(15), sessao(16)]);
    expect(c.map((x) => [x.sessoes, x.valor])).toEqual([
      [1, 115],
      [1, 115],
    ]);
  });

  it("mês inteiro na primeira quinzena: uma cobrança só, vencendo no dia dela", () => {
    const c = quinzenal([sessao(3), sessao(10)]);
    expect(c.map((x) => [x.sessoes, x.valor, x.vencimento?.getDate()])).toEqual([[2, 230, 5]]);
  });
});

describe("o que não muda", () => {
  it("a chave de cada quinzena continua estável (é por ela que o pagamento se prende)", () => {
    const c = quinzenal([sessao(3), sessao(20)]);
    expect(c.map((x) => x.chave.endsWith(":1") || x.chave.endsWith(":2"))).toEqual([true, true]);
    expect(c[0].chave).not.toBe(c[1].chave);
  });

  it("as duas são do tipo quinzena, cobradas antes", () => {
    const c = quinzenal([sessao(3), sessao(20)]);
    expect(c.every((x) => x.tipo === "quinzena" && x.posicao === "antes")).toBe(true);
  });
});
