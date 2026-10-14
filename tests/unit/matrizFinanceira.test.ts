import { describe, expect, it } from "vitest";
import { matrizFinanceira, anosDisponiveis, type PacienteFin } from "@/lib/matrizFinanceira";

const pacientes: PacienteFin[] = [
  {
    id: "a", nome: "Paciente A",
    cobrancas: [
      // Jan: pago 200. Fev: pago 150. Mar: pago 200.
      { vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-05", valor: 200 }] },
      { vencimento: "2026-02-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-02-05", valor: 150 }] },
      { vencimento: "2026-03-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-03-05", valor: 200 }] },
    ],
  },
  {
    id: "b", nome: "Paciente B",
    cobrancas: [
      { vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-05", valor: 100 }] },
      { vencimento: "2026-02-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-02-05", valor: 200 }] },
      // Mar em atraso 100 (não pago)
      { vencimento: "2026-03-05", situacao: "em_atraso", falta: 100, pagamentos: [] },
    ],
  },
];

describe("matriz financeira (doc 41)", () => {
  it("filtro Pagos: exemplo do doc (Jan/Fev/Mar + total)", () => {
    const m = matrizFinanceira(pacientes, 2026, "pagos");
    const a = m.linhas.find((l) => l.id === "a")!;
    expect([a.meses[0], a.meses[1], a.meses[2], a.total]).toEqual([200, 150, 200, 550]);
    const b = m.linhas.find((l) => l.id === "b")!;
    expect([b.meses[0], b.meses[1], b.meses[2], b.total]).toEqual([100, 200, 0, 300]);
    // Totais mensais e geral
    expect([m.totalMes[0], m.totalMes[1], m.totalMes[2]]).toEqual([300, 350, 200]);
    expect(m.totalGeral).toBe(850);
  });

  it("filtro Em atraso: só a falta vencida, pelo mês do vencimento", () => {
    const m = matrizFinanceira(pacientes, 2026, "atraso");
    expect(m.linhas.map((l) => l.id)).toEqual(["b"]); // A não tem atraso
    expect(m.linhas[0].meses[2]).toBe(100);
    expect(m.totalGeral).toBe(100);
  });

  it("filtro Todos: pago + atraso, sem somar o mesmo valor duas vezes", () => {
    const m = matrizFinanceira(pacientes, 2026, "todos");
    // Total geral = 850 (pagos) + 100 (atraso) = 950.
    expect(m.totalGeral).toBe(950);
  });

  it("respeita o ano: 2027 vazio", () => {
    const m = matrizFinanceira(pacientes, 2027, "pagos");
    expect(m.linhas).toHaveLength(0);
    expect(m.totalGeral).toBe(0);
  });

  it("crédito do saldo não conta como pago", () => {
    const comCredito: PacienteFin[] = [{ id: "c", nome: "C", cobrancas: [
      { vencimento: "2026-04-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-04-05", valor: 80 }, { data: "2026-04-05", valor: 20, credito: true }] },
    ] }];
    const m = matrizFinanceira(comCredito, 2026, "pagos");
    expect(m.linhas[0].meses[3]).toBe(80); // só o dinheiro, não o crédito
  });

  it("anos disponíveis, do mais recente ao mais antigo", () => {
    expect(anosDisponiveis(pacientes)).toEqual([2026]);
  });
});
