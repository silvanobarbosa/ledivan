import { describe, expect, it } from "vitest";
import { aplicacoesDeCredito, type CobrancaAberta, type CreditoDisponivel } from "@/lib/creditoPendente";

/**
 * O CRÉDITO VAI SOZINHO PARA A PRÓXIMA SESSÃO QUE TEM O QUE PAGAR (doc 59).
 *
 * O crédito nasceu de uma sessão que não aconteceu: o paciente já pagou, e não há decisão a tomar,
 * só um lugar novo para o dinheiro adiantado. O que o documento cobra em letra é o contorno —
 * aonde ele pode ir, quanto leva, e que não volte a ser oferecido depois de usado.
 */

const d = (dia: number) => new Date(2026, 10, dia, 11, 0);
const cob = (chave: string, dia: number, falta: number, rotulo = "AVUL"): CobrancaAberta =>
  ({ chave, rotulo, falta, sessaoId: chave.split(":")[1], data: d(dia) });
const credito = (id: string, valor: number): CreditoDisponivel => ({ id, valor, origemPagamentoId: `pg-${id}` });

describe("aplicacoesDeCredito", () => {
  it("vai para a próxima sessão AVUL, com o valor que ela deve", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 50)], [credito("c1", 50)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ creditoId: "c1", valor: 50, chave: "sessao:s2", sobra: 0 });
  });

  it("serve também a X/X — é sessão de pacote, e pacote se paga", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 200, "2/4")], [credito("c1", 200)]);
    expect(r.map((x) => x.chave)).toEqual(["sessao:s2"]);
  });

  it("e a cobrança DO PACOTE, que não tem rótulo próprio porque cobre várias sessões", () => {
    const linha: CobrancaAberta = { chave: "pacote:2026-11-01:1", tipo: "pacote", falta: 400, sessaoId: null, data: d(9) };
    expect(aplicacoesDeCredito([linha], [credito("c1", 400)]).map((x) => x.chave)).toEqual(["pacote:2026-11-01:1"]);
  });

  it("NÃO vai para uma GRAT — seria pagar uma sessão gratuita, e o dinheiro sumiria", () => {
    expect(aplicacoesDeCredito([cob("sessao:s2", 9, 50, "GRAT")], [credito("c1", 50)])).toEqual([]);
  });

  it("nem para cobrança que já está paga", () => {
    expect(aplicacoesDeCredito([cob("sessao:s2", 9, 0)], [credito("c1", 50)])).toEqual([]);
  });

  it("a mais antiga primeiro — é a ordem em que as sessões aconteceram", () => {
    const r = aplicacoesDeCredito([cob("sessao:s3", 16, 50), cob("sessao:s2", 9, 50)], [credito("c1", 100)]);
    expect(r.map((x) => x.chave)).toEqual(["sessao:s2", "sessao:s3"]);
  });

  it("crédito PARCIAL: leva o que tem, e a diferença fica em aberto", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 50)], [credito("c1", 30)]);
    expect(r[0]).toMatchObject({ valor: 30, sobra: 0 });
    // Nada mais é aplicado: os R$ 20 restantes continuam devidos, não viram "pago".
    expect(r).toHaveLength(1);
  });

  it("crédito MAIOR que a cobrança: entra o devido, o resto continua disponível", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 50)], [credito("c1", 80)]);
    expect(r[0]).toMatchObject({ valor: 50, sobra: 30 });
  });

  it("e essa sobra segue para a cobrança seguinte, sem ser oferecida duas vezes", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 50), cob("sessao:s3", 16, 50)], [credito("c1", 80)]);
    expect(r.map((x) => [x.chave, x.valor])).toEqual([["sessao:s2", 50], ["sessao:s3", 30]]);
    // 80 ao todo, nunca 130: o mesmo crédito não paga duas cobranças inteiras.
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(80);
  });

  it("NÃO É ACUMULATIVO: crédito já consumido não chega aqui, e o que chega é usado uma vez só", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 500)], [credito("c1", 50), credito("c2", 50)]);
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(100);
  });

  it("leva junto o pagamento de origem — é dele que saem data, forma e quem pagou", () => {
    const r = aplicacoesDeCredito([cob("sessao:s2", 9, 50)], [credito("c1", 50)]);
    expect(r[0].origemPagamentoId).toBe("pg-c1");
  });

  it("sem cobrança elegível, o crédito espera — não se perde nem se força em lugar nenhum", () => {
    expect(aplicacoesDeCredito([], [credito("c1", 50)])).toEqual([]);
  });
});
