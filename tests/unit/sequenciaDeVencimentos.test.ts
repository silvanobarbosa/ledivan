import { describe, it, expect } from "vitest";
import { pinsDaSequenciaAnterior } from "@/lib/sequenciaDeVencimentos";

/**
 * DOC 20 — "sim não está deslocando o mês das próximas parcelas (sem pagamento)".
 *
 * O caso real da Celani: as parcelas futuras tinham data gravada uma a uma pelo comportamento
 * antigo, e a regra nova (doc 19) nunca aparecia na tela porque a data explícita ganha dela. Uma
 * sequência nova manda do seu ponto em diante — e isso inclui apagar os pins daquele trecho.
 */
const c = (chave: string, natural: string, pago = false) => ({ chave, vencimentoNatural: natural, vencimento: natural, pago });

describe("doc 20: os pins que pertencem à sequência anterior", () => {
  it("as parcelas do trecho governado pela regra nova perdem a data pinada", () => {
    const cobrancas = [c("a", "2026-10-10"), c("b", "2026-11-10"), c("c", "2026-12-10")];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-11-10", excluir: "b" })).toEqual(["c"]);
  });

  it("o que vem ANTES do ponto não se mexe — a sequência velha continua mandando lá", () => {
    const cobrancas = [c("a", "2026-09-10"), c("b", "2026-10-10"), c("z", "2027-01-10")];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-12-01", excluir: "x" })).toEqual(["z"]);
  });

  it("cobrança COM pagamento não entra — é o “(sem pagamento)” do próprio botão", () => {
    const cobrancas = [c("paga", "2026-12-10", true), c("aberta", "2027-01-10")];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-01-01", excluir: "x" })).toEqual(["aberta"]);
  });

  it("a cobrança que está sendo editada fica fora: a data dela é a que a pessoa acabou de escolher", () => {
    const cobrancas = [c("editada", "2026-11-10"), c("outra", "2026-12-10")];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-11-10", excluir: "editada" })).toEqual(["outra"]);
  });

  it("mede pelo vencimento NATURAL, não pelo que está na tela — senão o ponto escorrega a cada rodada", () => {
    const cobrancas = [{ chave: "a", vencimentoNatural: "2026-10-10", vencimento: "2026-12-10", pago: false }];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-11-01", excluir: "x" })).toEqual([]);
  });

  it("sem natural, cai no vencimento exibido — cobrança antiga não fica de fora por falta de dado", () => {
    const cobrancas = [{ chave: "a", vencimentoNatural: null, vencimento: "2026-12-10", pago: false }];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-11-01", excluir: "x" })).toEqual(["a"]);
  });

  it("data com hora não atrapalha a comparação", () => {
    const cobrancas = [{ chave: "a", vencimentoNatural: "2026-12-10T15:00:00.000Z", vencimento: null, pago: false }];
    expect(pinsDaSequenciaAnterior(cobrancas, { aPartirDe: "2026-12-10T12:00:00", excluir: "x" })).toEqual(["a"]);
  });

  it("sem ponto de partida não apaga nada — na dúvida, não se mexe em data de ninguém", () => {
    expect(pinsDaSequenciaAnterior([c("a", "2026-12-10")], { aPartirDe: "", excluir: "x" })).toEqual([]);
  });
});
