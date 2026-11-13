import { describe, expect, it } from "vitest";
import { apagaOValorDaFalta } from "@/lib/valorQueNasceuDaFalta";

/**
 * QUANDO O VALOR DE UMA SESSÃO PODE SER APAGADO — e, principalmente, quando NÃO pode.
 *
 * A regra nasceu no doc 54: o valor da falta cobrada do paciente gratuito só existe por causa da
 * resposta "Sim, cobra"; saindo de "Faltou", a resposta é limpa e o valor vai junto, senão ele
 * ressuscita sozinho se o status voltar.
 *
 * Só que a condição escrita era ampla demais — "mudou para qualquer coisa que não é Faltou" — e
 * `valorExtra` deixou de ser só o valor da falta: desde o doc 62 ele é O VALOR DAQUELA SESSÃO, o
 * que o lápis da coluna Valor escreve. Com isso, marcar "Presente" numa sessão com valor próprio
 * apagava o valor, e a cobrança virava R$ 0,00 em silêncio. O dono viu pelo "Desmarcou"; o
 * caminho mais curto para o mesmo estrago é o botão que ela mais usa.
 */

const falta = { status: "nao_realizada", faltouConta: true, extra: null, valorExtra: "130.00" };

describe("o valor que nasceu da falta", () => {
  it("é apagado ao sair de Faltou", () => {
    expect(apagaOValorDaFalta(falta, "realizada")).toBe(true);
    expect(apagaOValorDaFalta(falta, "cancelada")).toBe(true);
  });

  it("continua enquanto a sessão for Faltou", () => {
    expect(apagaOValorDaFalta(falta, "nao_realizada")).toBe(false);
  });
});

describe("o valor DAQUELA SESSÃO (doc 62) não é apagado por mudança de status", () => {
  const comValorProprio = { status: "agendada", faltouConta: null, extra: null, valorExtra: "130.00" };

  it("marcar Presente não apaga", () => {
    expect(apagaOValorDaFalta(comValorProprio, "realizada")).toBe(false);
  });

  it("marcar Desmarcou não apaga", () => {
    expect(apagaOValorDaFalta(comValorProprio, "cancelada")).toBe(false);
  });

  /**
   * A falta que respondeu NÃO nunca teve valor digitado pela janela — o "Não" não abre o campo.
   * Se há valor ali, ele veio do lápis, e apagá-lo é perder o que a terapeuta escreveu.
   */
  it("falta respondida com Não também não apaga", () => {
    expect(apagaOValorDaFalta({ ...falta, faltouConta: false }, "realizada")).toBe(false);
  });
});

describe("as bordas de sempre", () => {
  it("sessão EXTRA nunca entra: o valor dela é do agendamento", () => {
    expect(apagaOValorDaFalta({ ...falta, extra: "avul" }, "realizada")).toBe(false);
  });

  it("sem valor nenhum, não há o que apagar", () => {
    expect(apagaOValorDaFalta({ ...falta, valorExtra: null }, "realizada")).toBe(false);
  });
});
