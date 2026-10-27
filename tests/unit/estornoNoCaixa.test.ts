import { describe, expect, it } from "vitest";
import { movimentosDoEstorno } from "@/lib/estornoNoCaixa";

/**
 * O ESTORNO NO CAIXA TEM DUAS PONTAS, E SOMA ZERO (doc 57/58).
 *
 * O extrato monta as entradas a partir do casamento do pagamento com a cobrança. Desfeita a
 * cobrança, o pagamento para de casar e a entrada evapora — então mostrar só a saída tiraria do mês
 * um dinheiro que nunca apareceu nele. É a duplicidade ao contrário.
 */

const saldo = (movs: { tipo: string; bruto: number }[]) =>
  movs.reduce((s, m) => s + (m.tipo === "entrada" ? m.bruto : -m.bruto), 0);

const pagamento = { valor: "200.00", data: "2026-10-24", paciente: "Marcela", sessaoId: "s1", sessaoEm: "2026-10-28" };
const estorno = { valor: "200.00", data: "2026-11-01", paciente: "Marcela", sessaoId: "s1", sessaoEm: "2026-10-28" };

describe("movimentosDoEstorno", () => {
  it("escreve as duas pontas, cada uma no seu dia", () => {
    const movs = movimentosDoEstorno([pagamento], [estorno]);
    expect(movs.map((m) => [m.data, m.tipo, m.bruto])).toEqual([
      ["2026-10-24", "entrada", 200],
      ["2026-11-01", "saida", 200],
    ]);
  });

  it("e o saldo fecha em zero — o dinheiro entrou e voltou", () => {
    expect(saldo(movimentosDoEstorno([pagamento], [estorno]))).toBe(0);
  });

  it("virou CRÉDITO: só a entrada, porque o dinheiro não voltou para ninguém", () => {
    const movs = movimentosDoEstorno([pagamento], []);
    expect(movs).toHaveLength(1);
    expect(saldo(movs)).toBe(200);
  });

  it("valor zerado não vira linha — linha de R$ 0,00 no extrato é ruído", () => {
    expect(movimentosDoEstorno([{ ...pagamento, valor: 0 }], [{ ...estorno, valor: null }])).toEqual([]);
  });

  it("diz o que é, de quem e de qual sessão nas duas pontas (doc 62)", () => {
    const movs = movimentosDoEstorno([pagamento], [estorno]);
    expect(movs.map((m) => m.descricao)).toEqual([
      "Pagamento · Marcela · Sessão 28/10/26",
      "Estorno · Marcela · Sessão 28/10/26",
    ]);
  });

  it("sem sessão conhecida, a descrição não inventa uma", () => {
    const movs = movimentosDoEstorno([{ ...pagamento, sessaoEm: null }], []);
    expect(movs[0].descricao).toBe("Pagamento · Marcela");
  });

  it("as duas pontas carregam o mesmo par — é ele que junta as duas na tela", () => {
    const movs = movimentosDoEstorno([pagamento], [estorno]);
    expect(movs.map((m) => m.par)).toEqual(["s1", "s1"]);
  });
});
