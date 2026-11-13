import { describe, expect, it } from "vitest";
import { AVISO_DO_CREDITO, valorSugeridoDaAvulsa } from "@/lib/creditoNaAvulsa";

/**
 * O VALOR QUE O CAMPO DA SESSÃO AVULSA JÁ VEM PREENCHIDO (dono, 13/11/2026).
 *
 * "Ao inserir uma sessão do tipo não adicionar à sequência do pacote — sim (avul), o valor a
 * aparecer deve ser o valor que está como crédito (…) se o crédito for de 100 e o paciente digitar
 * valor 50, na próxima sessão inserida deve aparecer com o saldo restante."
 *
 * O campo já nascia preenchido — com o preço do cadastro. A troca é de FONTE: havendo crédito, é
 * ele que manda, porque é o dinheiro que já está na mão e precisa ser gasto. Sem crédito, nada
 * muda.
 *
 * O "saldo restante" não é conta deste arquivo: quem consome o crédito é o motor de pagamentos, e
 * o saldo chega aqui já descontado. Recalcular aqui criaria uma segunda verdade sobre o mesmo
 * dinheiro — o defeito que este app já pagou caro.
 */

describe("havendo crédito, ele manda", () => {
  it("o campo vem com o valor do crédito", () => {
    expect(valorSugeridoDaAvulsa({ credito: 100, precoDaSessao: 130 })).toEqual({ valor: 100, porCredito: true });
  });

  it("gasto metade, a próxima sessão vem com o que sobrou", () => {
    // 100 de crédito, digitou 50 na sessão anterior → o saldo que chega aqui já é 50.
    expect(valorSugeridoDaAvulsa({ credito: 50, precoDaSessao: 130 })).toEqual({ valor: 50, porCredito: true });
  });

  it("crédito maior que o preço também manda — é o dinheiro que está lá", () => {
    expect(valorSugeridoDaAvulsa({ credito: 300, precoDaSessao: 130 })).toEqual({ valor: 300, porCredito: true });
  });

  it("centavos não viram dízima", () => {
    expect(valorSugeridoDaAvulsa({ credito: 33.333, precoDaSessao: 130 }).valor).toBe(33.33);
  });
});

describe("sem crédito, o preço do cadastro continua valendo", () => {
  it("crédito zerado", () => {
    expect(valorSugeridoDaAvulsa({ credito: 0, precoDaSessao: 130 })).toEqual({ valor: 130, porCredito: false });
  });

  it("crédito ausente", () => {
    expect(valorSugeridoDaAvulsa({ precoDaSessao: "130.00" })).toEqual({ valor: 130, porCredito: false });
  });

  /** Nem preço nem crédito: o campo fica vazio, para a terapeuta digitar. Zero seria um palpite. */
  it("sem preço e sem crédito, não inventa número", () => {
    expect(valorSugeridoDaAvulsa({})).toEqual({ valor: null, porCredito: false });
  });

  /**
   * Sobra de centavo não é crédito utilizável: oferecer R$ 0,004 como valor da sessão seria pior do
   * que não oferecer nada. O corte é o mesmo meio centavo que o resto do app já usa.
   */
  it("resto menor que meio centavo não conta como crédito", () => {
    expect(valorSugeridoDaAvulsa({ credito: 0.004, precoDaSessao: 130 })).toEqual({ valor: 130, porCredito: false });
  });

  it("crédito negativo é lixo de dado, não um desconto", () => {
    expect(valorSugeridoDaAvulsa({ credito: -50, precoDaSessao: 130 })).toEqual({ valor: 130, porCredito: false });
  });
});

describe("o aviso embaixo da caixa", () => {
  it("é o texto do dono, inteiro", () => {
    expect(AVISO_DO_CREDITO).toBe("O paciente possui um crédito neste valor.");
  });
});
