import { describe, it, expect } from "vitest";
import { acrescentaDitado, carimbo, promptDoCampo, tetoDoCampo, textoLimpo } from "@/lib/ditado";

/**
 * O doc 76 pede, com todas as letras, que uma gravação nova NÃO apague a anterior e que cada uma
 * guarde data e hora. É a parte da feature que um teste alcança — o resto é microfone e modelo.
 */

describe("ditado — o que o modelo devolve vira texto de prontuário", () => {
  it("tira o rótulo e as aspas que o modelo põe por hábito", () => {
    expect(textoLimpo('Título: "Primeira sessão"', "titulo")).toBe("Primeira sessão");
    expect(textoLimpo("Evolução: O paciente relatou melhora.", "registro")).toBe("O paciente relatou melhora.");
  });

  it("título é UMA linha e não termina em ponto", () => {
    expect(textoLimpo("Sessão 12.\nOutra coisa aqui", "titulo")).toBe("Sessão 12");
  });

  it("registro mantém os parágrafos, mas não três quebras seguidas", () => {
    expect(textoLimpo("Um.\n\n\n\nDois.", "registro")).toBe("Um.\n\nDois.");
  });

  it("o teto do título é curto de propósito", () => {
    expect(tetoDoCampo("titulo")).toBeLessThan(tetoDoCampo("registro"));
    expect(textoLimpo("x".repeat(500), "titulo").length).toBe(120);
  });

  it("cada campo pede uma coisa diferente ao modelo", () => {
    expect(promptDoCampo("titulo")).toContain("TÍTULO");
    expect(promptDoCampo("registro")).toContain("EVOLUÇÃO");
    expect(promptDoCampo("anamnese", "Queixa principal")).toContain('"Queixa principal"');
  });

  it("os três proíbem inventar — prontuário é documento legal", () => {
    for (const c of ["titulo", "registro", "anamnese"] as const) {
      expect(promptDoCampo(c)).toContain("NUNCA acrescente informação que não foi dita");
    }
  });
});

describe("ditado — gravação nova NÃO apaga a anterior (doc 76, itens 7 e 8)", () => {
  const t1 = new Date(2026, 10, 12, 14, 35);
  const t2 = new Date(2026, 10, 12, 15, 2);

  it("campo vazio recebe o bloco sozinho", () => {
    expect(acrescentaDitado("", "Primeiro relato.", t1)).toBe("[12/11/2026 14:35] Primeiro relato.");
  });

  it("a segunda gravação entra DEPOIS, sem tocar na primeira", () => {
    const um = acrescentaDitado("", "Primeiro relato.", t1);
    const dois = acrescentaDitado(um, "Segundo relato.", t2);
    expect(dois).toBe("[12/11/2026 14:35] Primeiro relato.\n\n[12/11/2026 15:02] Segundo relato.");
    expect(dois.startsWith(um)).toBe(true);
  });

  it("o que a terapeuta escreveu à mão continua lá", () => {
    const r = acrescentaDitado("Anotação escrita no teclado.", "Ditado depois.", t1);
    expect(r).toContain("Anotação escrita no teclado.");
    expect(r).toContain("[12/11/2026 14:35] Ditado depois.");
  });

  it("ditado vazio não acrescenta bloco nenhum", () => {
    expect(acrescentaDitado("Só o que já havia.", "   ", t1)).toBe("Só o que já havia.");
  });

  it("o carimbo tem dois dígitos em tudo — ordenar texto depende disso", () => {
    expect(carimbo(new Date(2026, 0, 5, 9, 7))).toBe("[05/01/2026 09:07]");
  });
});
