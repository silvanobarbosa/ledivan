import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";
import type { SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O QUE A COLUNA DE PAGAMENTO DIZ quando a sessão deixa de ser cobrada (doc 55).
 *
 * Os dois textos existem pela mesma razão: uma linha que esvazia sem explicação, numa tabela de
 * dinheiro, vira dúvida — e a dúvida mais cara é "para onde foi o que o paciente pagou?".
 */

const base = (extra: Partial<SessaoDaCobranca> & { estornoValor?: number }, formato = "gratuito"): EntradaDaGeral => ({
  vigencias: [],
  reserva: { formato, pacoteTipo: null },
  precos: [{ valor: 200, desde: new Date(2024, 0, 1) }],
  valorDaSessao: 200,
  tamanhos: [],
  sessoes: [{ id: "s0", date: new Date(2026, 9, 23, 11, 0), status: "nao_realizada", ...extra }] as EntradaDaGeral["sessoes"],
  pagamentos: [],
  hoje: new Date(2026, 9, 30),
});

const aviso = (e: EntradaDaGeral) => {
  const l = linhasDaGeral(e).find((x) => x.tipo === "sessao");
  return l && l.tipo === "sessao" ? l.avisoDoPagamento : undefined;
};

describe("aviso na coluna de pagamento", () => {
  it("avulsa que voltou a ser gratuita diz isso", () => {
    expect(aviso(base({ faltouConta: false }))).toBe("Sessão avulsa que foi convertida para gratuita");
  });

  it("estorno diz o valor devolvido", () => {
    expect(aviso(base({ faltouConta: false, estornoValor: 150 }))).toBe("Estorno realizado no valor de R$ 150,00");
  });

  it("o estorno vem na frente: houve dinheiro recebido e devolvido, e isso é mais forte", () => {
    // A sessão também virou gratuita, mas quem olha precisa ver o estorno primeiro.
    const l = aviso(base({ faltouConta: false, estornoValor: 80 }));
    expect(l).toContain("Estorno");
    expect(l).not.toContain("convertida");
  });

  it("sessão que segue cobrada não ganha aviso nenhum", () => {
    expect(aviso(base({ faltouConta: true }))).toBeNull();
  });

  it("falta sem resposta também não — nada foi desfeito", () => {
    expect(aviso(base({}))).toBeNull();
  });

  it("no pacote não há cobrança própria da sessão para desfazer", () => {
    expect(aviso(base({ faltouConta: false }, "mensal"))).toBeNull();
  });
});
