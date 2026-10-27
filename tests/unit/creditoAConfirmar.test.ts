import { describe, it, expect } from "vitest";
import { creditoParaAbater, perguntaOAbatimento, perguntaDaConversao, perguntaDoLancamento } from "@/lib/creditoAConfirmar";

const semEspacoDuro = (s: string) => s.replace(/\u00a0/g, " ");

describe("o crédito que espera um Sim (doc 61)", () => {
  it("sem nada marcado, o saldo abate como sempre", () => {
    expect(creditoParaAbater({ disponivel: 50, aConfirmar: 0, usar: false })).toBe(50);
  });

  it("marcado e sem o Sim, ele NÃO entra no lançamento", () => {
    expect(creditoParaAbater({ disponivel: 50, aConfirmar: 50, usar: false })).toBe(0);
  });

  it("marcado e com o Sim, ele entra inteiro", () => {
    expect(creditoParaAbater({ disponivel: 50, aConfirmar: 50, usar: true })).toBe(50);
  });

  it("o saldo pode ser parte marcado e parte livre — só a parte livre abate sozinha", () => {
    expect(creditoParaAbater({ disponivel: 80, aConfirmar: 30, usar: false })).toBe(50);
    expect(creditoParaAbater({ disponivel: 80, aConfirmar: 30, usar: true })).toBe(80);
  });

  it("marcado maior que o disponível não cria saldo negativo", () => {
    expect(creditoParaAbater({ disponivel: 20, aConfirmar: 50, usar: false })).toBe(0);
  });

  it("a pergunta volta enquanto sobra crédito marcado, e para quando ele acaba", () => {
    expect(perguntaOAbatimento(30)).toBe(true);
    expect(perguntaOAbatimento(0)).toBe(false);
    expect(perguntaOAbatimento(0.001)).toBe(false);
  });

  it("os textos são os do documento", () => {
    expect(semEspacoDuro(perguntaDaConversao(50))).toBe(
      "Este cadastro possui um crédito de R$ 50,00. Deseja utilizá-lo agora?");
    expect(semEspacoDuro(perguntaDoLancamento(30.5))).toBe(
      "Deseja abater o crédito de R$ 30,50 deste pagamento?");
  });
});
