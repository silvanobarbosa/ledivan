import { describe, expect, it } from "vitest";
import {
  COMO_REFAZER_DESMARCOU,
  DESMARCOU_PERGUNTA,
  desmarcouCobrando,
  ofereceEscolhaDoDesmarcou,
} from "@/lib/desmarcouDoAvulso";

/**
 * A ESCOLHA DO "DESMARCOU" — quem a recebe, e o que ela faz com o dinheiro.
 *
 * Documento do dono (12/11/2026): ao desmarcar uma sessão AVULSA, a terapeuta decide se a
 * cobrança fica de pé esperando pagamento ou se sai da guia Geral. Até aqui "Desmarcou" apagava a
 * cobrança sem perguntar — e uma sessão desmarcada em cima da hora, que ela combinou cobrar,
 * sumia do financeiro sem deixar rastro.
 *
 * O que estes testes travam é o ALCANCE: a escolha é só do avulso (e do mensal/quinzenal cuja
 * sessão saiu da sequência, que é AVUL na tela). Pacote e gratuito seguem como sempre.
 */

describe("quem recebe a pergunta", () => {
  it("o avulso recebe", () => {
    expect(ofereceEscolhaDoDesmarcou("avulso")).toBe(true);
  });

  /**
   * O pacote NÃO recebe: a sessão desmarcada dentro da sequência não tem cobrança própria para
   * manter — o que se cobra é o pacote, e a posição dela volta para a sessão seguinte. Oferecer a
   * escolha ali prometeria um dinheiro que não existe naquela linha.
   */
  it("o pacote não recebe", () => {
    expect(ofereceEscolhaDoDesmarcou("pacote")).toBe(false);
  });

  /** O gratuito não tem valor a manter pendente — a pergunta seria sobre R$ 0,00. */
  it("o gratuito não recebe", () => {
    expect(ofereceEscolhaDoDesmarcou("gratuito")).toBe(false);
  });
});

describe("a cobrança que fica de pé", () => {
  it("desmarcada com o Sim continua cobrando", () => {
    expect(desmarcouCobrando({ status: "cancelada", desmarcouCobra: true })).toBe(true);
  });

  it("desmarcada com o Não não cobra", () => {
    expect(desmarcouCobrando({ status: "cancelada", desmarcouCobra: false })).toBe(false);
  });

  /**
   * Sem resposta é o comportamento de sempre: desmarcou, não cobra. Toda sessão desmarcada ANTES
   * deste documento tem `null` aqui — e nenhuma delas pode começar a cobrar sozinha.
   */
  it("desmarcada sem resposta não cobra (é o legado)", () => {
    expect(desmarcouCobrando({ status: "cancelada", desmarcouCobra: null })).toBe(false);
    expect(desmarcouCobrando({ status: "cancelada" })).toBe(false);
  });

  /** `realocada` é legado e a tela a rotula "Desmarcou" — se tiver a marca, vale igual. */
  it("a realocada legada também vale", () => {
    expect(desmarcouCobrando({ status: "realocada", desmarcouCobra: true })).toBe(true);
  });

  /**
   * A marca só tem efeito em quem está DESMARCADO. Uma sessão que saiu de "Desmarcou" e foi para
   * "Faltou" ou "Presente" é cobrada (ou não) pelas regras dela — a resposta antiga não pode
   * atravessar e cobrar duas vezes o mesmo atendimento.
   */
  it("a marca não vale fora do Desmarcou", () => {
    expect(desmarcouCobrando({ status: "nao_realizada", desmarcouCobra: true })).toBe(false);
    expect(desmarcouCobrando({ status: "realizada", desmarcouCobra: true })).toBe(false);
    expect(desmarcouCobrando({ status: "prof_desmarcou", desmarcouCobra: true })).toBe(false);
  });
});

describe("o texto da janela", () => {
  it("pergunta pelo pagamento pendente, e diz o que cada resposta faz", () => {
    expect(DESMARCOU_PERGUNTA.titulo).toBe("Deseja manter o pagamento pendente para que seja realizado posteriormente?");
    // Doc 12/11 (2º anexo): o texto do dono é "permanece na guia Geral, para o lançamento do
    // pagamento" — e nada de "em aberto/atrasado", que é o nome do estado, não o que ela faz.
    expect(DESMARCOU_PERGUNTA.explicaSim).toContain("para o lançamento do pagamento");
    expect(DESMARCOU_PERGUNTA.explicaSim).not.toContain("Financeiro Geral");
    expect(DESMARCOU_PERGUNTA.explicaNao).toContain("sem gerar cobrança");
  });

  it("a saída diz o nome do botão que refaz a escolha", () => {
    expect(COMO_REFAZER_DESMARCOU).toContain('"Desmarcou"');
  });
});
