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
    expect(meses[0]).toEqual({ mes: "Janeiro", valor: 500 });
    expect(meses[8]).toEqual({ mes: "Setembro", valor: 400 });
    expect(meses[11]).toEqual({ mes: "Dezembro", valor: 0 }); // o de dez estava pending
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
