import { describe, expect, it } from "vitest";
import { podeSerCortesia } from "@/lib/cortesia";

/**
 * Doc 65 (dono, 28/10/2026): a cortesia é oferecida em TODO agendamento.
 *
 * O recorte do doc 54 (só mensal/quinzenal em pacote completo) e o do SuperQA de 22/10 (fora das
 * extras) foram substituídos pelo pedido do dono: a pergunta aparece nos três financeiros e
 * também no gratuito. O que o SuperQA apontou continua valendo como exigência — a escolha tem de
 * fazer efeito —, e é por isso que `cobrancas` passou a não cobrar a extra marcada como cortesia
 * (ver cortesiaNoAvulsoEGratuito.test.ts).
 */
describe("podeSerCortesia — onde a pergunta aparece (doc 65)", () => {
  it("o financeiro não entra mais na conta: a consulta comum sempre oferece", () => {
    expect(podeSerCortesia({ sessionKind: "consulta" })).toBe(true);
    expect(podeSerCortesia({ sessionKind: null })).toBe(true);
  });

  it("devolutiva fica de fora: ela já tem a própria escolha de cobrar ou abater do pacote", () => {
    expect(podeSerCortesia({ sessionKind: "devolutiva" })).toBe(false);
  });

  it("sessão sem tipo informado é consulta comum, e oferece", () => {
    expect(podeSerCortesia({})).toBe(true);
    expect(podeSerCortesia({ sessionKind: undefined })).toBe(true);
  });
});
