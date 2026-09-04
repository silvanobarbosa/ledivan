import { describe, it, expect } from "vitest";
import { parseMoedaBR, moedaOuPadrao } from "@/lib/money";

describe("parseMoedaBR", () => {
  it("valor pt-BR com milhar e centavos", () => {
    expect(parseMoedaBR("1.500,00")).toBe("1500.00"); // era o crash 22P02
    expect(parseMoedaBR("1.000.000,50")).toBe("1000000.50");
  });

  it("vírgula decimal simples", () => {
    expect(parseMoedaBR("200,00")).toBe("200.00");
    expect(parseMoedaBR("150,5")).toBe("150.50");
  });

  it("prefixo de moeda e espaços", () => {
    expect(parseMoedaBR("R$ 200,00")).toBe("200.00");
    expect(parseMoedaBR(" R$1.200,90 ")).toBe("1200.90");
  });

  it("ponto como decimal (teclado numérico, sem vírgula)", () => {
    expect(parseMoedaBR("200.50")).toBe("200.50");
    expect(parseMoedaBR("200.5")).toBe("200.50");
  });

  it("'1.500' sem centavos é mil e quinhentos, NÃO 1,50", () => {
    expect(parseMoedaBR("1.500")).toBe("1500.00"); // o bug silencioso
    expect(parseMoedaBR("1.000")).toBe("1000.00");
  });

  it("inteiro puro", () => {
    expect(parseMoedaBR("200")).toBe("200.00");
  });

  it("negativo (ajuste/estorno)", () => {
    expect(parseMoedaBR("-50,00")).toBe("-50.00");
    expect(parseMoedaBR("-1.200,00")).toBe("-1200.00");
  });

  it("vazio/nulo/lixo → null", () => {
    expect(parseMoedaBR("")).toBeNull();
    expect(parseMoedaBR(null)).toBeNull();
    expect(parseMoedaBR(undefined)).toBeNull();
    expect(parseMoedaBR("abc")).toBeNull();
  });
});

describe("moedaOuPadrao", () => {
  it("cai no padrão quando vazio/inválido", () => {
    expect(moedaOuPadrao("", "0")).toBe("0");
    expect(moedaOuPadrao("abc", "0")).toBe("0");
    expect(moedaOuPadrao(null)).toBe("0");
  });
  it("converte quando válido", () => {
    expect(moedaOuPadrao("1.500,00")).toBe("1500.00");
  });
});
