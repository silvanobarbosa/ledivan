import { describe, it, expect } from "vitest";
import { normalizarTaxa, liquidoComTaxa } from "@/lib/finance";

describe("normalizarTaxa", () => {
  it("aceita vírgula e arredonda a 2 casas", () => {
    expect(normalizarTaxa("1,99")).toBe(1.99);
    expect(normalizarTaxa("3.456")).toBe(3.46);
  });
  it("limita a faixa 0–100 e descarta lixo", () => {
    expect(normalizarTaxa("-5")).toBe(0);
    expect(normalizarTaxa("250")).toBe(100);
    expect(normalizarTaxa("abc")).toBe(0);
    expect(normalizarTaxa(undefined)).toBe(0);
  });
});

describe("liquidoComTaxa", () => {
  const fees = { debito: 1.5, credito: 4 };
  it("desconta a taxa de débito e crédito", () => {
    expect(liquidoComTaxa(100, "debito", fees)).toBe(98.5);
    expect(liquidoComTaxa(100, "credito", fees)).toBe(96);
  });
  it("outras formas não têm taxa", () => {
    expect(liquidoComTaxa(100, "pix", fees)).toBe(100);
    expect(liquidoComTaxa(100, "dinheiro", fees)).toBe(100);
    expect(liquidoComTaxa(100, null, fees)).toBe(100);
  });
  it("sem taxas configuradas devolve o bruto", () => {
    expect(liquidoComTaxa(100, "credito", undefined)).toBe(100);
    expect(liquidoComTaxa(100, "credito", {})).toBe(100);
    expect(liquidoComTaxa(100, "credito", { credito: 0 })).toBe(100);
  });
  it("valor inválido devolve o próprio valor", () => {
    expect(liquidoComTaxa(0, "credito", fees)).toBe(0);
  });
});
