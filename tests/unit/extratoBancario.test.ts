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

/**
 * Doc 62: o estorno é desenhado logo abaixo do pagamento que ele desfez, mesmo tendo acontecido
 * semanas depois. As duas pontas do mesmo fato precisam ser lidas juntas.
 */
describe("o estorno fica junto da sessão referente", () => {
  const pagamento = mov({ data: "2026-10-24", descricao: "Pagamento · Marcela · Sessão 28/10/26", par: "s1" });
  const estorno = mov({ data: "2026-11-01", descricao: "Estorno · Marcela · Sessão 28/10/26", tipo: "saida", par: "s1" });

  it("sobe para logo depois do pagamento, saltando o que está entre eles", () => {
    const out = ordenarExtrato([estorno, mov({ data: "2026-10-28", descricao: "aluguel" }), pagamento]);
    expect(out.map((m) => m.descricao)).toEqual([
      "Pagamento · Marcela · Sessão 28/10/26",
      "Estorno · Marcela · Sessão 28/10/26",
      "aluguel",
    ]);
  });

  it("sem o pagamento na lista, a saída volta para o lugar dela no calendário", () => {
    const out = ordenarExtrato([mov({ data: "2026-12-01", descricao: "depois" }), estorno, mov({ data: "2026-10-01", descricao: "antes" })]);
    expect(out.map((m) => m.descricao)).toEqual(["antes", "Estorno · Marcela · Sessão 28/10/26", "depois"]);
  });

  it("saída sem par nenhum continua só pela data", () => {
    const out = ordenarExtrato([mov({ data: "2026-10-20", descricao: "b", tipo: "saida" }), mov({ data: "2026-10-10", descricao: "a" })]);
    expect(out.map((m) => m.descricao)).toEqual(["a", "b"]);
  });

  it("dois estornos de sessões diferentes vão cada um para o seu pagamento", () => {
    const p2 = mov({ data: "2026-10-25", descricao: "pg2", par: "s2" });
    const e2 = mov({ data: "2026-11-02", descricao: "est2", tipo: "saida", par: "s2" });
    const out = ordenarExtrato([e2, estorno, p2, pagamento]);
    expect(out.map((m) => m.descricao)).toEqual([
      "Pagamento · Marcela · Sessão 28/10/26",
      "Estorno · Marcela · Sessão 28/10/26",
      "pg2",
      "est2",
    ]);
  });
});
