import { describe, it, expect } from "vitest";
import { pagamentosPorMes } from "@/lib/pagamentosPorMes";
import { type CobrancaResolvida } from "@/lib/vencimentosDoDia";

function cob(over: Partial<CobrancaResolvida> & { chave: string }): CobrancaResolvida {
  return { cadastroId: "p", nome: "Fulano", telefone: null, grupo: "avulsa", vencimento: "2026-01-10T12:00:00", situacao: "em_aberto", valor: 100, falta: 100, enviosTotal: 0, ...over };
}

describe("pagamentosPorMes (doc 46)", () => {
  it("agrupa por mês do ano, decrescente, com totais e resumo", () => {
    const todas = [
      cob({ chave: "a", vencimento: "2026-01-10T12:00:00", situacao: "em_atraso", valor: 100, falta: 100 }),
      cob({ chave: "b", vencimento: "2026-02-15T12:00:00", situacao: "pago", valor: 300, falta: 0 }),
      cob({ chave: "c", vencimento: "2026-01-20T12:00:00", situacao: "em_aberto", valor: 100, falta: 100 }),
      cob({ chave: "d", vencimento: "2025-12-01T12:00:00" }), // outro ano, fora
    ];
    const { meses, resumo } = pagamentosPorMes(todas, 2026);
    expect(meses.map((m) => m.mes)).toEqual(["2026-02", "2026-01"]); // mais recente primeiro
    expect(meses[1].esperado).toBe(200);
    expect(meses[1].aberto).toBe(200);
    expect(resumo.atrasados).toEqual({ qtd: 1, total: 100 });
    expect(resumo.aberto).toEqual({ qtd: 1, total: 100 });
    expect(resumo.pagos).toEqual({ qtd: 1, total: 300 });
  });

  it("pagamento parcial: pago = valor - falta; aberto = falta", () => {
    const { meses } = pagamentosPorMes([cob({ chave: "p", situacao: "em_aberto", valor: 150, falta: 100 })], 2026);
    expect(meses[0].pago).toBe(50);
    expect(meses[0].aberto).toBe(100);
  });
});
