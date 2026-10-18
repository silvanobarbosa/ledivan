import { describe, it, expect } from "vitest";
import { matrizFinanceira, type PacienteFin } from "@/lib/matrizFinanceira";
import { recebidosPorAno } from "@/lib/tabelaAnual";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

const vigs: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 2, credito: 5 }];

describe("doc 50 — líquido nas áreas de cobrança", () => {
  it("matrizFinanceira soma o recebido pelo LÍQUIDO (cartão desconta)", () => {
    const pacientes: PacienteFin[] = [{
      id: "p", nome: "Fulano", cobrancas: [{
        vencimento: "2026-03-10", situacao: "pago", falta: 0,
        pagamentos: [
          { data: "2026-03-10", valor: 100, metodo: "credito" }, // 5% → 95
          { data: "2026-03-12", valor: 100, metodo: "pix" },     // sem taxa → 100
        ],
      }],
    }];
    const m = matrizFinanceira(pacientes, 2026, "pagos", vigs);
    expect(m.linhas[0].meses[2]).toBe(195); // março (índice 2): 95 + 100
    expect(m.totalGeral).toBe(195);
  });

  it("matrizFinanceira sem vigências usa o bruto", () => {
    const pacientes: PacienteFin[] = [{
      id: "p", nome: "F", cobrancas: [{ vencimento: "2026-03-10", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-03-10", valor: 100, metodo: "credito" }] }],
    }];
    expect(matrizFinanceira(pacientes, 2026, "pagos").totalGeral).toBe(100);
  });

  it("recebidosPorAno soma pelo líquido", () => {
    const r = recebidosPorAno([
      { amount: "100", date: "2026-04-10T12:00:00", status: "paid", method: "debito" }, // 2% → 98
      { amount: "50", date: "2026-04-11T12:00:00", status: "paid", method: "dinheiro" }, // 50
      { amount: "999", date: "2026-04-12T12:00:00", status: "pending", method: "pix" }, // não pago, fora
    ], 2026, vigs);
    expect(r.meses[3].valor).toBe(148); // abril: 98 + 50
    expect(r.total).toBe(148);
  });
});
