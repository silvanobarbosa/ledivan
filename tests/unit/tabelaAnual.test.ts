import { type VigenciaTaxa } from "@/lib/taxaCartao";
import { describe, it, expect } from "vitest";
import { anosComPagamento, recebidosPorAno } from "@/lib/tabelaAnual";

const pg = (amount: number, date: string, status = "paid") => ({ amount: String(amount), date, status });

describe("anos com pagamento", () => {
  it("lista os anos com pagamento recebido, do mais recente ao mais antigo", () => {
    expect(anosComPagamento([pg(100, "2025-03-01"), pg(200, "2026-01-10"), pg(50, "2025-12-20")])).toEqual([2026, 2025]);
  });
  it("ignora pagamento não pago", () => {
    expect(anosComPagamento([pg(100, "2026-01-01", "pending")])).toEqual([]);
  });
  it("data inválida não entra", () => {
    expect(anosComPagamento([pg(100, "sem-data")])).toEqual([]);
  });
});

describe("recebidos por ano", () => {
  const pags = [
    pg(300, "2026-01-15"),
    pg(200, "2026-01-20"),
    pg(400, "2026-09-05"),
    pg(999, "2025-09-05"),        // outro ano
    pg(150, "2026-12-31", "pending"), // não pago
  ];

  it("soma por mês só o que foi pago naquele ano", () => {
    const { meses, total } = recebidosPorAno(pags, 2026);
    // `toMatchObject` e não `toEqual`: o doc 53 acrescentou `formas` à linha, e o que este
    // caso quer provar é a SOMA do mês — não a forma exata do objeto.
    expect(meses[0]).toMatchObject({ mes: "Janeiro", valor: 500 });
    expect(meses[8]).toMatchObject({ mes: "Setembro", valor: 400 });
    expect(meses[11]).toMatchObject({ mes: "Dezembro", valor: 0 }); // o de dez estava pending
    expect(total).toBe(900);
  });

  it("são sempre 12 meses, em ordem", () => {
    const { meses } = recebidosPorAno(pags, 2026);
    expect(meses).toHaveLength(12);
    expect(meses[0].mes).toBe("Janeiro");
    expect(meses[11].mes).toBe("Dezembro");
  });

  it("ano sem pagamento dá tudo zero", () => {
    const { total, meses } = recebidosPorAno(pags, 2020);
    expect(total).toBe(0);
    expect(meses.every((m) => m.valor === 0)).toBe(true);
  });
});

/**
 * Doc 53: a tabela anual passa a detalhar por FORMA de pagamento, e o total do mês continua
 * sendo o LÍQUIDO — líquido dos cartões + bruto das demais formas. É a regra do item 3 do doc,
 * expressa em número.
 */
describe("quebra por forma na tabela anual (doc 53)", () => {
  const vig: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 1, credito: 2, credito2x: 3, credito3x: 4, credito4x: 5, credito5x: 6 }];

  it("o mês mostra cada forma, e o total soma líquido do cartão + bruto do resto", () => {
    const r = recebidosPorAno([
      { amount: "100", date: "2026-03-10", status: "paid", method: "credito_5x" }, // 6% -> 94
      { amount: "100", date: "2026-03-11", status: "paid", method: "pix" },        // sem taxa -> 100
    ], 2026, vig);
    const marco = r.meses[2];
    expect(marco.valor).toBe(194);
    expect(marco.formas.map((f) => f.curto).sort()).toEqual(["Cre 5x", "Pix"]);
    const cre = marco.formas.find((f) => f.metodo === "credito_5x")!;
    expect([cre.bruto, cre.liquido, cre.temTaxa]).toEqual([100, 94, true]);
    const pix = marco.formas.find((f) => f.metodo === "pix")!;
    expect([pix.bruto, pix.liquido, pix.temTaxa]).toEqual([100, 100, false]);
  });

  it("mês sem pagamento vem sem formas — a tela mostra travessão, não lista vazia", () => {
    const r = recebidosPorAno([], 2026, vig);
    expect(r.meses[0].valor).toBe(0);
    expect(r.meses[0].formas).toEqual([]);
  });

  it("o total do ano continua batendo com a soma dos meses", () => {
    const r = recebidosPorAno([
      { amount: "200", date: "2026-01-05", status: "paid", method: "debito" },  // 1% -> 198
      { amount: "100", date: "2026-02-05", status: "paid", method: "cash" },    // -> 100
    ], 2026, vig);
    expect(r.total).toBe(298);
    expect(r.meses.reduce((a, m) => a + m.valor, 0)).toBeCloseTo(298, 2);
  });
});
