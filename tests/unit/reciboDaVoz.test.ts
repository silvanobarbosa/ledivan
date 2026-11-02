import { describe, it, expect } from "vitest";
import { quandoDoRecibo } from "@/lib/reciboDaVoz";

/**
 * O instante do recibo. Se ele mostrar a hora errada, a prova deixa de provar: a terapeuta olha
 * "às 12:41" numa anotação que ela ditou às 09:41 e conclui, com razão, que o app está confuso.
 */

describe("quandoDoRecibo", () => {
  it("hora de parede guardada como texto sai como ela foi gravada", () => {
    expect(quandoDoRecibo("2026-11-02T09:41:00")).toBe("02/11/2026 às 09:41");
  });

  it("o mesmo para a Date que o driver devolve (lida pelos campos UTC)", () => {
    expect(quandoDoRecibo(new Date("2026-11-02T09:41:00Z"))).toBe("02/11/2026 às 09:41");
  });

  it("meia-noite não vira o dia anterior", () => {
    expect(quandoDoRecibo("2026-11-02T00:10:00")).toBe("02/11/2026 às 00:10");
  });

  it("sem data, sem recibo de data — não inventa agora", () => {
    expect(quandoDoRecibo(null)).toBe("");
    expect(quandoDoRecibo(undefined)).toBe("");
    expect(quandoDoRecibo("não é data")).toBe("");
  });
});
