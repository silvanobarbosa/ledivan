import { describe, expect, it } from "vitest";
import { linhasDaGeral, resumoDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";

/**
 * OS TRÊS STATUS DO PAGAMENTO (documento de 18/09).
 *
 * A dona, com todas as letras:
 *
 * - **Em aberto**: ainda não tem data de pagamento lançada e o vencimento não passou.
 * - **Atrasado**: ainda não tem data de pagamento lançada e o vencimento passou.
 * - **Pago**: tem data de pagamento lançada.
 *
 * E a regra que manda em todas: *"o pagamento só poderá ser considerado pago quando existir uma
 * data de pagamento efetivamente lançada. Apenas a existência de um vencimento, a passagem da data
 * de vencimento ou qualquer outra informação financeira não deve alterar o pagamento para 'pago'."*
 *
 * Até aqui a conta era outra: "pago" era **saldo zerado**. Uma cobrança que nascia valendo R$ 0,00
 * — o que acontece quando o preço da data não é conhecido — aparecia **verde, escrita "Pago"**, sem
 * ninguém ter pago e sem data nenhuma. Não é um caso de laboratório: na base de demonstração são 12
 * pacientes de 103 sem faixa de preço que alcance as sessões.
 */

const desde = new Date(2026, 0, 1);
const hoje = new Date(2026, 8, 15, 12);
const terca = (dia: number, mes = 8) => ({ id: `s${mes}-${dia}`, date: new Date(2026, mes, dia, 9), status: "realizada" });

const entrada = (extra: Partial<EntradaDaGeral> = {}): EntradaDaGeral => ({
  vigencias: [{ formato: "sessao", desde }],
  reserva: { formato: "sessao" },
  precos: [{ valor: 130, desde }],
  sessoes: [terca(1), terca(22)], // 01/09 já venceu; 22/09 ainda não
  pagamentos: [],
  hoje,
  ...extra,
});

const pg = (valor: number, dia: number, chave: string) => ({
  id: `pg-${chave}`, valor, data: new Date(2026, 8, dia), status: "paid",
  metodo: "pix", pagoPor: "Ana", cobrancaChave: chave,
});

/** A situação de cada cobrança, na ordem das linhas. */
const situacoes = (e: EntradaDaGeral) =>
  linhasDaGeral(e)
    .map((l) => (l.tipo === "sessao" ? l.cobranca : l))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => c.situacao);

describe("sem data de pagamento lançada", () => {
  it("vencimento no futuro é EM ABERTO", () => {
    expect(situacoes(entrada())[1]).toBe("em_aberto");
  });

  it("vencimento passado é EM ATRASO", () => {
    expect(situacoes(entrada())[0]).toBe("em_atraso");
  });
});

describe("com data de pagamento lançada", () => {
  it("vira PAGO", () => {
    const e = entrada({ pagamentos: [pg(130, 1, "sessao:s8-1")] });
    expect(situacoes(e)[0]).toBe("pago");
  });

  it("e a linha carrega a data de quem pagou", () => {
    const e = entrada({ pagamentos: [pg(130, 1, "sessao:s8-1")] });
    const c = linhasDaGeral(e).map((l) => (l.tipo === "sessao" ? l.cobranca : null)).find((x) => x?.situacao === "pago");
    expect(c?.pagamento?.pagoPor).toBe("Ana");
  });
});

describe("a regra que manda: valor zerado NÃO é pagamento", () => {
  /**
   * O caso que a regra dela corrige. Paciente sem faixa de preço que alcance a data: a cobrança
   * nasce valendo R$ 0,00 e, pela conta de saldo, ficava "quitada" no ato.
   */
  const semPreco = () => entrada({ precos: [], valorDaSessao: 0 });

  it("cobrança de R$ 0,00 sem baixa NÃO é paga", () => {
    expect(situacoes(semPreco()).every((s) => s !== "pago")).toBe(true);
  });

  it("ela segue a mesma regra dos outros: vencida é atraso, a vencer é em aberto", () => {
    expect(situacoes(semPreco())).toEqual(["em_atraso", "em_aberto"]);
  });

  it("e não inventa uma linha de pagamento", () => {
    const linhas = linhasDaGeral(semPreco());
    const cobrancas = linhas.map((l) => (l.tipo === "sessao" ? l.cobranca : null)).filter(Boolean);
    expect(cobrancas.every((c) => c!.pagamento === null)).toBe(true);
  });

  it("com baixa lançada, aí sim é paga — mesmo valendo zero", () => {
    const e = entrada({ precos: [], valorDaSessao: 0, pagamentos: [pg(0, 1, "sessao:s8-1")] });
    expect(situacoes(e)[0]).toBe("pago");
  });
});

describe("pagamento pela metade", () => {
  const meio = () => entrada({ pagamentos: [pg(60, 1, "sessao:s8-1")] });

  it("não é pago — falta dinheiro", () => {
    expect(situacoes(meio())[0]).not.toBe("pago");
  });

  it("segue a regra do vencimento: já venceu, então está em atraso", () => {
    expect(situacoes(meio())[0]).toBe("em_atraso");
  });

  it("mas o que JÁ foi pago não some da tela", () => {
    // Antes a linha zerava `pagamento` quando não estava quitada, e quem pagou metade aparecia
    // como se não tivesse pago nada.
    const c = linhasDaGeral(meio()).map((l) => (l.tipo === "sessao" ? l.cobranca : null)).find(Boolean);
    expect(c?.pagamento?.pagoPor).toBe("Ana");
    expect(c?.falta).toBe(70);
  });
});

describe("o resumo do paciente acompanha", () => {
  it("cobrança de R$ 0,00 sem baixa não entra como paga no total", () => {
    const r = resumoDaGeral(entrada({ precos: [], valorDaSessao: 0 }));
    expect(r.totalPago).toBe(0);
  });
});
