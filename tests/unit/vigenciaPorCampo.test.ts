import { describe, it, expect } from "vitest";
import { camposFinanceirosAlterados, dataCorrigeVigenciaDoPreco } from "@/lib/vigenciaPorCampo";

/**
 * DOC 62 — A VIGÊNCIA É DO CAMPO QUE MUDOU, NÃO DA TELA.
 *
 * O caso do dono, palavra por palavra: o paciente tem valor da sessão R$ 150 com vigência de
 * 01/09 e vencimento dia 10, também de 01/09. A terapeuta altera **somente o Reajuste**, com
 * vigência 01/11. Só o reajuste pode receber 01/11 — o valor e o vencimento ficam com a vigência
 * que tinham.
 *
 * Antes, mexer na data já bastava para o app "corrigir" a vigência do último preço (doc 75),
 * porque a condição olhava só se a data tinha sido tocada. A correção continua existindo: ela é
 * como se conserta uma vigência digitada errada. O que mudou é que ela só vale quando o preço é a
 * ÚNICA coisa em jogo.
 */
describe("doc 62: quais campos financeiros mudaram", () => {
  it("campo intocado não entra, mesmo com os outros mudando", () => {
    const antes = { valor: 150, vencimento: 10, reajuste: 6 };
    const depois = { valor: 150, vencimento: 10, reajuste: 12 };
    expect(camposFinanceirosAlterados(antes, depois)).toEqual(["reajuste"]);
  });

  it("vazio e nulo são a mesma ausência — trocar um pelo outro não é alteração", () => {
    expect(camposFinanceirosAlterados({ pagarAte: null }, { pagarAte: "" })).toEqual([]);
    expect(camposFinanceirosAlterados({ vencimento2: undefined }, { vencimento2: null })).toEqual([]);
  });

  it("número e texto do mesmo número são o mesmo valor — o formulário manda texto", () => {
    expect(camposFinanceirosAlterados({ vencimento: 10 }, { vencimento: "10" })).toEqual([]);
  });

  it("vários campos de uma vez saem todos", () => {
    const antes = { valor: 150, sessoes: 4, reajuste: 6 };
    const depois = { valor: 180, sessoes: 8, reajuste: 6 };
    expect(camposFinanceirosAlterados(antes, depois).sort()).toEqual(["sessoes", "valor"]);
  });
});

describe("doc 62: a data só corrige a vigência do preço quando o preço está sozinho", () => {
  const base = { vigenciaEditada: true, dataNova: new Date(2026, 10, 1), dataAtual: new Date(2026, 8, 1) };

  it("mexeu SÓ na data: corrige a vigência do preço — é o conserto do doc 75", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, alterados: [] })).toBe(true);
  });

  it("mexeu na data E no reajuste: a data é do reajuste, o preço não se move", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, alterados: ["reajuste"] })).toBe(false);
  });

  it("mexeu na data E no vencimento: idem", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, alterados: ["vencimento"] })).toBe(false);
  });

  it("o próprio preço entre os alterados também tira a correção de cena — ali se grava preço novo", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, alterados: ["valor"] })).toBe(false);
  });

  it("não tocou na data: não corrige nada", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, vigenciaEditada: false, alterados: [] })).toBe(false);
  });

  it("a data digitada é a MESMA já gravada: não há o que corrigir", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, dataNova: new Date(2026, 8, 1, 23, 59), alterados: [] })).toBe(false);
  });

  it("sem data, ou sem preço gravado, não corrige", () => {
    expect(dataCorrigeVigenciaDoPreco({ ...base, dataNova: null, alterados: [] })).toBe(false);
    expect(dataCorrigeVigenciaDoPreco({ ...base, dataAtual: null, alterados: [] })).toBe(false);
    expect(dataCorrigeVigenciaDoPreco({ ...base, dataNova: new Date("x"), alterados: [] })).toBe(false);
  });
});
