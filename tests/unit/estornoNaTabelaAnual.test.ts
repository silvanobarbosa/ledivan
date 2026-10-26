import { describe, expect, it } from "vitest";
import { recebidosPorAno } from "@/lib/tabelaAnual";

/**
 * O ESTORNO NA TABELA "Valores recebidos em xxxx" (doc 60).
 *
 * A tabela mostrava só a entrada: o paciente pagou R$ 200 em outubro, a terapeuta devolveu os
 * R$ 200 no mesmo mês, e o ano continuava dizendo que entraram R$ 200. O dono pediu o registro das
 * DUAS pontas — é a mesma regra que Movimentações já segue, e pelo mesmo motivo: metade do fato
 * contada sozinha vira número errado com cara de certo.
 */
const pg = (amount: number, date: string) => ({ amount: String(amount), date, status: "paid", method: "pix" });

describe("estorno na tabela anual", () => {
  it("aparece como saída do mês em que foi feito, e o ano fecha pelo líquido", () => {
    const { meses, total } = recebidosPorAno([pg(200, "2026-10-23")], 2026, [], [{ valor: "200.00", data: "2026-10-25" }]);
    expect(meses[9].valor).toBe(200);
    expect(meses[9].estornado).toBe(200);
    expect(total).toBe(0);
  });

  it("estorno em mês diferente do pagamento fica no mês dele", () => {
    const { meses, total } = recebidosPorAno([pg(200, "2026-10-23")], 2026, [], [{ valor: "200.00", data: "2026-11-03" }]);
    expect(meses[9].estornado).toBe(0);
    expect(meses[10].estornado).toBe(200);
    expect(total).toBe(0);
  });

  it("estorno de outro ano não entra neste", () => {
    const { meses } = recebidosPorAno([pg(200, "2026-10-23")], 2026, [], [{ valor: "200.00", data: "2025-10-25" }]);
    expect(meses.every((m) => m.estornado === 0)).toBe(true);
  });

  it("sem estorno nenhum, nada muda", () => {
    const { meses, total } = recebidosPorAno([pg(150, "2026-03-10")], 2026, []);
    expect(meses[2].valor).toBe(150);
    expect(meses[2].estornado).toBe(0);
    expect(total).toBe(150);
  });
});
