import { describe, expect, it } from "vitest";
import { numeracaoDoPacote, sessoesDoMes, valorDoPacote } from "@/lib/pacoteMes";

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

describe("numeracaoDoPacote — fragmentado", () => {
  it("numera dentro de cada mês, como no exemplo do dono", () => {
    const m = numeracaoDoPacote(quartas, "fragmentado");
    expect(m.get("a")).toEqual({ index: 1, total: 3 });
    expect(m.get("c")).toEqual({ index: 3, total: 3 });
    expect(m.get("d")).toEqual({ index: 1, total: 4 });
    expect(m.get("g")).toEqual({ index: 4, total: 4 });
  });

  it("sessão cancelada sai e as seguintes renumeram", () => {
    const comBaixa = quartas.map((s) => (s.id === "a" ? { ...s, status: "cancelada" } : s));
    const m = numeracaoDoPacote(comBaixa, "fragmentado");
    expect(m.has("a")).toBe(false);
    expect(m.get("b")).toEqual({ index: 1, total: 2 });
    expect(m.get("c")).toEqual({ index: 2, total: 2 });
  });

  it("ordena por data, mesmo recebendo fora de ordem", () => {
    const m = numeracaoDoPacote([quartas[2], quartas[0], quartas[1]], "fragmentado");
    expect(m.get("a")!.index).toBe(1);
    expect(m.get("c")!.index).toBe(3);
  });
});

describe("numeracaoDoPacote — completo", () => {
  it("vai de 1/4 a 4/4 e recomeça, atravessando o mês", () => {
    const m = numeracaoDoPacote(quartas, "completo");
    expect(m.get("a")).toEqual({ index: 1, total: 4 });
    expect(m.get("d")).toEqual({ index: 4, total: 4 });
    expect(m.get("e")).toEqual({ index: 1, total: 4 });
  });

  it("sem pacote informado, trata como completo", () => {
    expect(numeracaoDoPacote(quartas, null).get("a")).toEqual({ index: 1, total: 4 });
  });
});

describe("valorDoPacote", () => {
  it("multiplica o valor da sessão pelo total do mês", () => {
    expect(valorDoPacote(200, 3)).toBe(600);
    expect(valorDoPacote(200, 4)).toBe(800);
  });

  it("sem valor ou sem sessão, é zero", () => {
    expect(valorDoPacote(0, 4)).toBe(0);
    expect(valorDoPacote(200, 0)).toBe(0);
  });
});
