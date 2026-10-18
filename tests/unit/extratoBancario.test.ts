import { describe, it, expect } from "vitest";
import { ordenarExtrato, type Movimentacao } from "@/lib/extratoBancario";

const mov = (over: Partial<Movimentacao> & { data: string; descricao: string }): Movimentacao => ({
  tipo: "entrada", efetivado: true, bruto: 100, liquido: 100, temLiquido: false, ...over,
});

describe("ordenarExtrato", () => {
  it("ordem cronológica (mais antiga primeiro)", () => {
    const out = ordenarExtrato([
      mov({ data: "2026-10-15", descricao: "c" }),
      mov({ data: "2026-10-05", descricao: "a" }),
      mov({ data: "2026-10-12", descricao: "b" }),
    ]);
    expect(out.map((m) => m.descricao)).toEqual(["a", "b", "c"]);
  });
  it("não muta o array original", () => {
    const orig = [mov({ data: "2026-02-02", descricao: "x" }), mov({ data: "2026-01-01", descricao: "y" })];
    ordenarExtrato(orig);
    expect(orig[0].descricao).toBe("x");
  });
});
