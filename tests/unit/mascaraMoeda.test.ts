import { describe, expect, it } from "vitest";
import { mascaraMoeda, valorDaMascara } from "@/lib/mascaraMoeda";
import { parseMoedaBR } from "@/lib/money";

/**
 * O campo de dinheiro se escreve sozinho (doc 57).
 *
 * Antes era texto livre, e `parseMoedaBR` adivinhava depois: "200" é duzentos ou dois? "1.500" é
 * mil e quinhentos ou um e cinquenta? A regra existe, mas é invisível para quem digita no meio do
 * dia. Com a máscara não há o que adivinhar — os dígitos entram pela direita, como na maquininha.
 */

describe("mascaraMoeda", () => {
  it("os dígitos entram pela direita, centavos primeiro", () => {
    expect(mascaraMoeda("2")).toBe("R$ 0,02");
    expect(mascaraMoeda("20")).toBe("R$ 0,20");
    expect(mascaraMoeda("200")).toBe("R$ 2,00");
    expect(mascaraMoeda("20000")).toBe("R$ 200,00");
  });

  it("separa o milhar sem que ninguém precise digitar o ponto", () => {
    expect(mascaraMoeda("150000")).toBe("R$ 1.500,00");
    expect(mascaraMoeda("123456789")).toBe("R$ 1.234.567,89");
  });

  it("ignora o que não é dígito — colar 'R$ 1.500,00' dá o mesmo valor", () => {
    expect(mascaraMoeda("R$ 1.500,00")).toBe("R$ 1.500,00");
    expect(mascaraMoeda("abc200def")).toBe("R$ 2,00");
  });

  it("vazio continua VAZIO, nunca R$ 0,00", () => {
    // Um campo que insiste em "R$ 0,00" depois de apagar tudo parece preenchido, e ela salva o
    // zero sem querer.
    expect(mascaraMoeda("")).toBe("");
    expect(mascaraMoeda("R$ ")).toBe("");
    expect(mascaraMoeda("abc")).toBe("");
  });

  it("apagar anda para trás, dígito a dígito", () => {
    // É o que o backspace produz: o texto chega sem o último caractere.
    expect(mascaraMoeda("R$ 200,0")).toBe("R$ 20,00");
    expect(mascaraMoeda("R$ 20,0")).toBe("R$ 2,00");
  });

  it("não deixa estourar a coluna do banco (numeric 10,2)", () => {
    expect(mascaraMoeda("99999999999999")).toBe("R$ 99.999.999,99");
  });

  it("zeros à esquerda não se acumulam", () => {
    expect(mascaraMoeda("000200")).toBe("R$ 2,00");
  });
});

describe("valorDaMascara", () => {
  it("devolve o número por trás do texto", () => {
    expect(valorDaMascara("R$ 200,00")).toBe(200);
    expect(valorDaMascara("R$ 1.500,50")).toBe(1500.5);
    expect(valorDaMascara("R$ 0,02")).toBe(0.02);
  });

  it("sem dígito nenhum é zero — e quem chama decide se zero vale", () => {
    expect(valorDaMascara("")).toBe(0);
    expect(valorDaMascara("R$ ")).toBe(0);
  });

  it("o que a máscara escreve, ela sabe ler de volta", () => {
    for (const cru of ["7", "70", "700", "7000", "123456"]) {
      expect(valorDaMascara(mascaraMoeda(cru))).toBe(Number(cru) / 100);
    }
  });
});

/**
 * A máscara escreve; `parseMoedaBR` grava. Se as duas discordarem, a tela mostra um valor e o banco
 * guarda outro — o pior defeito possível num campo de dinheiro, porque ninguém vê acontecer.
 */
describe("a máscara e o parser que grava concordam", () => {
  it("o que se vê é o que vai para o banco", () => {
    const pares = ["2", "200", "20000", "150000", "123456789"].map((d) => [mascaraMoeda(d), parseMoedaBR(mascaraMoeda(d))]);
    expect(pares).toEqual([
      ["R$ 0,02", "0.02"],
      ["R$ 2,00", "2.00"],
      ["R$ 200,00", "200.00"],
      ["R$ 1.500,00", "1500.00"],
      ["R$ 1.234.567,89", "1234567.89"],
    ]);
  });
});
