import { describe, it, expect } from "vitest";
import { normalizarTaxa } from "@/lib/finance";

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
