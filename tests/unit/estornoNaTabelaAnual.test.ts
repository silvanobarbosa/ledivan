import { describe, expect, it } from "vitest";
import { recebidosPorAno, anosComPagamento } from "@/lib/tabelaAnual";

/**
 * O QUE NÃO É DINHEIRO RECEBIDO NÃO ENTRA EM "Valores recebidos em xxxx" (doc 62).
 *
 * O doc 60 tinha posto o estorno à mostra na tabela, como saída em vermelho. O dono reviu: a
 * tabela é dos valores REAIS recebidos, e o estorno não é um deles — ele tem o lugar dele em
 * Movimentações, que conta as duas pontas do dinheiro. Aqui o pagamento devolvido simplesmente
 * sai de cena.
 *
 * Junto saem outros dois que nunca foram receita e entravam por descuido — o abatimento de
 * CRÉDITO (dinheiro já contado no dia em que entrou) e o crédito de PACOTE. Era por isso que a
 * tela da Marcela somava R$ 110 onde haviam entrado R$ 55.
 */
const pg = (amount: number, date: string, extra: Record<string, unknown> = {}) =>
  ({ amount: String(amount), date, status: "paid", method: "pix", ...extra });

describe("só dinheiro de verdade na tabela anual", () => {
  it("pagamento estornado não conta e não aparece", () => {
    const { meses, total } = recebidosPorAno([
      pg(50, "2026-10-27T09:00:00"),
      pg(50, "2026-10-27T10:00:00", { estornadoEm: "2026-10-27" }),
      pg(5, "2026-10-27T11:00:00"),
    ], 2026);
    expect(meses[9].recebimentos.map((r) => r.valor)).toEqual([50, 5]);
    expect(total).toBe(55);
  });

  it("abatimento de crédito não é dinheiro novo", () => {
    const { meses, total } = recebidosPorAno([
      pg(50, "2026-10-27T09:00:00"),
      pg(50, "2026-10-28T09:00:00", { kind: "credito" }),
    ], 2026);
    expect(meses[9].recebimentos).toHaveLength(1);
    expect(total).toBe(50);
  });

  it("crédito de pacote também fica de fora", () => {
    const { total } = recebidosPorAno([pg(400, "2026-03-01T09:00:00", { kind: "pacote" })], 2026);
    expect(total).toBe(0);
  });

  it("a lista de anos segue a mesma regra", () => {
    expect(anosComPagamento([
      pg(50, "2025-01-10T09:00:00", { estornadoEm: "2025-01-11" }),
      pg(50, "2026-01-10T09:00:00", { kind: "credito" }),
    ])).toEqual([]);
  });
});
