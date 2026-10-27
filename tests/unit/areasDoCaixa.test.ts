import { describe, it, expect } from "vitest";
import { fatiasDaPizza, totaisDoExtrato, totaisPorArea } from "@/lib/areasDoCaixa";
import { type Movimentacao } from "@/lib/extratoBancario";

const mov = (over: Partial<Movimentacao>): Movimentacao => ({
  data: "2026-10-10", descricao: "x", tipo: "entrada", efetivado: true, bruto: 100, liquido: 100, temLiquido: false, ...over,
});

describe("doc 64: o que cada área movimentou", () => {
  it("separa sessões, supervisões, receitas e despesas", () => {
    const totais = totaisPorArea([
      mov({ categoria: "sessao", liquido: 200 }),
      mov({ categoria: "sessao", liquido: 100 }),
      mov({ categoria: "supervisao", liquido: 150 }),
      mov({ categoria: "receita", liquido: 80 }),
      mov({ categoria: "despesa", tipo: "saida", liquido: 60 }),
    ]);
    expect(totais).toEqual({ sessao: 300, supervisao: 150, receita: 80, despesa: 60 });
  });

  it("o previsto não entra: promessa não é caixa", () => {
    expect(totaisPorArea([mov({ categoria: "sessao", liquido: 200, efetivado: false })]).sessao).toBe(0);
  });

  it("o estorno de uma sessão ABATE o que as sessões renderam", () => {
    const totais = totaisPorArea([
      mov({ categoria: "sessao", liquido: 200 }),
      mov({ categoria: "sessao", tipo: "saida", liquido: 50 }),
    ]);
    expect(totais.sessao).toBe(150);
  });

  it("a despesa soma pelo que saiu — fatia negativa não se desenha", () => {
    const totais = totaisPorArea([mov({ categoria: "despesa", tipo: "saida", liquido: 60 })]);
    expect(totais.despesa).toBe(60);
  });

  it("conta pelo LÍQUIDO: a taxa do cartão não vira receita", () => {
    expect(totaisPorArea([mov({ categoria: "sessao", bruto: 100, liquido: 95.5, temLiquido: true })]).sessao).toBe(95.5);
  });

  it("linha sem área não entra em fatia nenhuma", () => {
    expect(totaisPorArea([mov({ liquido: 500 })])).toEqual({ sessao: 0, supervisao: 0, receita: 0, despesa: 0 });
  });

  it("a pizza só desenha fatia com valor", () => {
    const fatias = fatiasDaPizza([
      mov({ categoria: "sessao", liquido: 300 }),
      mov({ categoria: "supervisao", liquido: 10 }),
      mov({ categoria: "supervisao", tipo: "saida", liquido: 10 }),
    ]);
    expect(fatias.map((f) => f.rotulo)).toEqual(["Sessões"]);
    expect(fatias[0].valor).toBe(300);
  });

  it("o total do extrato é entradas, saídas e saldo", () => {
    expect(totaisDoExtrato([
      mov({ categoria: "sessao", liquido: 300 }),
      mov({ categoria: "despesa", tipo: "saida", liquido: 120 }),
      mov({ categoria: "sessao", liquido: 999, efetivado: false }),
    ])).toEqual({ entradas: 300, saidas: 120, saldo: 180 });
  });
});
