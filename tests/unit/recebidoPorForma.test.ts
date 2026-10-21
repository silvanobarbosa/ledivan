import { describe, it, expect } from "vitest";
import { recebidoPorForma } from "@/lib/recebidoPorForma";
import { type VigenciaTaxa, FORMAS_COM_TAXA } from "@/lib/taxaCartao";

const vigs: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 2, credito: 5 }];

describe("recebidoPorForma", () => {
  it("agrupa por forma com bruto e líquido; só cartão desconta", () => {
    const r = recebidoPorForma([
      { valor: 100, metodo: "pix", data: "2026-03-10" },
      { valor: 100, metodo: "credito", data: "2026-03-10" },
      { valor: 100, metodo: "debito", data: "2026-03-10" },
    ], vigs);
    const pix = r.formas.find((f) => f.metodo === "pix")!;
    const cre = r.formas.find((f) => f.metodo === "credito")!;
    const deb = r.formas.find((f) => f.metodo === "debito")!;
    expect(pix).toMatchObject({ bruto: 100, liquido: 100, temTaxa: false });
    expect(cre).toMatchObject({ bruto: 100, liquido: 95, temTaxa: true });
    expect(deb).toMatchObject({ bruto: 100, liquido: 98, temTaxa: true });
    // Total pelo LÍQUIDO (100 + 95 + 98).
    expect(r.totalBruto).toBe(300);
    expect(r.totalLiquido).toBe(293);
  });

  it("ordem do doc: Pix, Deb, Cre, Din, Trans", () => {
    const r = recebidoPorForma([
      { valor: 10, metodo: "transfer", data: "2026-03-10" },
      { valor: 10, metodo: "cash", data: "2026-03-10" },
      { valor: 10, metodo: "credito", data: "2026-03-10" },
      { valor: 10, metodo: "debito", data: "2026-03-10" },
      { valor: 10, metodo: "pix", data: "2026-03-10" },
    ], vigs);
    expect(r.formas.map((f) => f.curto)).toEqual(["Pix", "Deb", "Cre", "Din", "Trans"]);
  });

  it("ignora formas zeradas e usa a taxa da data do pagamento", () => {
    const vs: VigenciaTaxa[] = [
      { validFrom: "2026-01-01", debito: 2, credito: 3 },
      { validFrom: "2026-06-01", debito: 2, credito: 6 },
    ];
    const r = recebidoPorForma([
      { valor: 100, metodo: "credito", data: "2026-03-10" }, // 3% → 97
      { valor: 100, metodo: "credito", data: "2026-07-10" }, // 6% → 94
    ], vs);
    const cre = r.formas.find((f) => f.metodo === "credito")!;
    expect(cre.bruto).toBe(200);
    expect(cre.liquido).toBe(191);
    expect(r.formas.length).toBe(1);
  });
});

/**
 * Doc 53: o líquido tem que APARECER para toda forma que sofre taxa.
 *
 * Havia três listas de "formas com taxa" no código — a do cálculo, a da exibição e a da ordem.
 * Quando 4x e 5x entraram, só a do cálculo foi atualizada: o desconto era aplicado e a tela
 * mostrava apenas o bruto. A conta batia, e ninguém via.
 */
describe("exibição do líquido acompanha o cálculo (doc 53)", () => {
  const vig: VigenciaTaxa[] = [{
    validFrom: "2026-01-01", debito: 1, credito: 2, credito2x: 3, credito3x: 4, credito4x: 5, credito5x: 6,
  }];

  it("toda forma que desconta também é marcada para mostrar o líquido", () => {
    for (const metodo of FORMAS_COM_TAXA) {
      const r = recebidoPorForma([{ valor: 100, metodo, data: "2026-06-10" }], vig);
      const f = r.formas.find((x) => x.metodo === metodo)!;
      expect(f, `forma ${metodo} sumiu do resumo`).toBeTruthy();
      expect(f.temTaxa, `forma ${metodo} desconta mas não mostra o líquido`).toBe(true);
      expect(f.liquido).toBeLessThan(f.bruto);
    }
  });

  it("crédito 4x e 5x aparecem com rótulo próprio, não como forma desconhecida", () => {
    const r = recebidoPorForma([
      { valor: 100, metodo: "credito_4x", data: "2026-06-10" },
      { valor: 100, metodo: "credito_5x", data: "2026-06-10" },
    ], vig);
    expect(r.formas.map((f) => f.curto)).toEqual(["Cre 4x", "Cre 5x"]);
  });

  it("formas sem taxa não são marcadas e têm líquido igual ao bruto", () => {
    for (const metodo of ["pix", "cash", "transfer"]) {
      const r = recebidoPorForma([{ valor: 100, metodo, data: "2026-06-10" }], vig);
      const f = r.formas.find((x) => x.bruto === 100)!;
      expect(f.temTaxa).toBe(false);
      expect(f.liquido).toBe(f.bruto);
    }
  });

  it("o total líquido soma o líquido dos cartões + o bruto das demais", () => {
    // É a regra do item 3 do doc 53, no número.
    const r = recebidoPorForma([
      { valor: 100, metodo: "credito_5x", data: "2026-06-10" }, // 6% -> 94
      { valor: 100, metodo: "pix", data: "2026-06-10" },        // sem taxa -> 100
    ], vig);
    expect(r.totalBruto).toBe(200);
    expect(r.totalLiquido).toBe(194);
  });
});
