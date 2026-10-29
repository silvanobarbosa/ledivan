import { describe, expect, it } from "vitest";
import { historicoDeReajuste } from "@/lib/reajuste";
import { QUEIXAS } from "@/lib/queixas";

const textos = (p: Parameters<typeof historicoDeReajuste>[0], f: Parameters<typeof historicoDeReajuste>[1]) =>
  historicoDeReajuste(p, f).map((l) => `${l.data.toISOString().slice(0, 10)} ${l.texto}`);

/**
 * HISTÓRICO DE REAJUSTE: "esta área não está cadastrando corretamente as mudanças" (doc 65).
 *
 * Estava cadastrando — o que faltava era a LINHA. O preço de entrada só aparecia quando o cadastro
 * não tinha histórico de modalidade nenhum; quem salvou valor e modalidade em dias diferentes
 * ficava com um preço vivo no banco e invisível na tela. Casos reais da base: um preço de entrada
 * em 01/08/2024 com a modalidade em 23/08/2024, e uma paciente gratuita com um preço solto.
 */
describe("doc 65 — o preço de entrada aparece quando tem vigência própria", () => {
  it("preço em 01/08 e modalidade em 23/08: as duas datas aparecem", () => {
    expect(textos(
      [{ valor: 50, dataEfetiva: new Date(2024, 7, 1) }, { valor: 65, dataEfetiva: new Date(2025, 9, 10) }],
      [{ formato: "mensal", dataEfetiva: new Date(2024, 7, 23) }],
    )).toEqual([
      "2024-08-01 Preço inicial → R$ 50,00",
      "2024-08-23 Mensal → R$ 50,00",
      "2025-10-10 Mensal → R$ 50,00 → R$ 65,00",
    ]);
  });

  it("mesma vigência para preço e modalidade: UMA linha só, sem repetir o valor", () => {
    expect(textos(
      [{ valor: 150, dataEfetiva: new Date(2024, 7, 23) }],
      [{ formato: "mensal", dataEfetiva: new Date(2024, 7, 23) }],
    )).toEqual(["2024-08-23 Mensal → R$ 150,00"]);
  });

  it("o preço solto de uma cadastrada como gratuita deixa de ser invisível", () => {
    expect(textos(
      [{ valor: 50, dataEfetiva: new Date(2026, 9, 28) }],
      [{ formato: "gratuito", dataEfetiva: new Date(2024, 7, 9) }],
    )).toEqual([
      "2024-08-09 Gratuito",
      "2026-10-28 Preço inicial → R$ 50,00",
    ]);
  });

  it("preço de entrada zerado não vira linha — não houve valor combinado", () => {
    expect(textos(
      [{ valor: 0, dataEfetiva: new Date(2024, 7, 1) }],
      [{ formato: "gratuito", dataEfetiva: new Date(2024, 7, 9) }],
    )).toEqual(["2024-08-09 Gratuito"]);
  });
});

describe("doc 65 — queixa principal", () => {
  it("Autoconhecimento entra na lista", () => {
    expect(QUEIXAS).toContain("Autoconhecimento");
  });
});
