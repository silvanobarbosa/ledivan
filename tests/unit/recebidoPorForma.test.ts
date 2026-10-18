import { describe, it, expect } from "vitest";
import { recebidoPorForma } from "@/lib/recebidoPorForma";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

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
