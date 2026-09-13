import { describe, expect, it } from "vitest";
import { sessoesDoMes } from "@/lib/pacoteMes";

// O exemplo que o dono escreveu à mão: toda quarta às 8h, a partir de 16/09/2026.
const quartas = [
  { id: "a", date: new Date(2026, 8, 16), status: "agendada" },
  { id: "b", date: new Date(2026, 8, 23), status: "agendada" },
  { id: "c", date: new Date(2026, 8, 30), status: "agendada" },
  { id: "d", date: new Date(2026, 9, 7), status: "agendada" },
  { id: "e", date: new Date(2026, 9, 14), status: "agendada" },
  { id: "f", date: new Date(2026, 9, 21), status: "agendada" },
  { id: "g", date: new Date(2026, 9, 28), status: "agendada" },
];

describe("sessoesDoMes", () => {
  it("conta as sessões dentro do mês", () => {
    expect(sessoesDoMes(quartas, 2026, 8)).toBe(3);  // setembro
    expect(sessoesDoMes(quartas, 2026, 9)).toBe(4);  // outubro
  });

  it("não conta cancelada nem realocada", () => {
    const comBaixa = quartas.map((s) => (s.id === "b" ? { ...s, status: "cancelada" } : s));
    expect(sessoesDoMes(comBaixa, 2026, 8)).toBe(2);
  });

  it("mês sem sessão é zero", () => {
    expect(sessoesDoMes(quartas, 2026, 10)).toBe(0);
  });
});
