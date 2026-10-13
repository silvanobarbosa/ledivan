import { describe, it, expect } from "vitest";
import { aplicarCreditoNoLancamento } from "@/lib/credito";

const run = (falta: number, cashRecebido: number, creditoDisponivel: number, creditarExcedente: boolean) =>
  aplicarCreditoNoLancamento({ falta, cashRecebido, creditoDisponivel, creditarExcedente });

describe("crédito no saldo (doc 36)", () => {
  it("pagamento exato, sem crédito: nada aplicado, nada gerado, fecha", () => {
    expect(run(100, 100, 0, false)).toEqual({ creditoAplicado: 0, creditoNovo: 0, fecha: true });
  });

  it("pagou a MAIS + Sim: a sobra vira crédito novo", () => {
    expect(run(100, 120, 0, true)).toEqual({ creditoAplicado: 0, creditoNovo: 20, fecha: true });
  });

  it("pagou a MAIS + Não: a sobra NÃO vira crédito", () => {
    expect(run(100, 120, 0, false)).toEqual({ creditoAplicado: 0, creditoNovo: 0, fecha: true });
  });

  it("usa o crédito disponível para fechar com menos dinheiro", () => {
    expect(run(100, 80, 20, false)).toEqual({ creditoAplicado: 20, creditoNovo: 0, fecha: true });
  });

  it("crédito insuficiente: aplica o que tem, não fecha", () => {
    expect(run(100, 50, 30, false)).toEqual({ creditoAplicado: 30, creditoNovo: 0, fecha: false });
  });

  it("crédito maior que a falta: aplica só o necessário (preenche a lacuna)", () => {
    expect(run(100, 90, 50, false)).toEqual({ creditoAplicado: 10, creditoNovo: 0, fecha: true });
  });

  it("dinheiro já cobre tudo: não consome crédito, e a sobra pode virar crédito novo", () => {
    expect(run(100, 120, 30, true)).toEqual({ creditoAplicado: 0, creditoNovo: 20, fecha: true });
  });

  it("não aplica crédito além do necessário quando o dinheiro já fecha", () => {
    expect(run(100, 100, 40, false)).toEqual({ creditoAplicado: 0, creditoNovo: 0, fecha: true });
  });

  it("arredonda para centavos", () => {
    const r = run(100, 33.33, 100, false);
    expect(r.creditoAplicado).toBe(66.67);
    expect(r.fecha).toBe(true);
  });
});
