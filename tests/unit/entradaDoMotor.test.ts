import { describe, expect, it } from "vitest";
import { pagamentoParaMotor, sessaoParaMotor } from "@/lib/entradaDoMotor";
import { COLUNAS_DA_SESSAO } from "@/lib/colunasDaSessao";

/**
 * O DADO QUE CHEGA DO BANCO PRECISA CHEGAR AO MOTOR (doc 58).
 *
 * `COLUNAS_DA_SESSAO` garantia que toda tela LESSE as mesmas colunas, e um teste já travava essa
 * lista. Não bastou: a lista de cadastros lia tudo e então remontava a sessão campo a campo, e
 * `faltouConta` ficou de fora da remontagem. A coluna chegava do banco e se perdia um andar
 * abaixo — com o mesmo sintoma de sempre: naquela tela a sessão AVUL convertida em GRAT continuava
 * cobrável, e o cadastro mostrava "Atrasado · 1" por uma cobrança que a guia Geral já não tinha.
 *
 * Por isso o teste não é sobre datas: é sobre NADA SE PERDER na travessia.
 */

describe("sessaoParaMotor", () => {
  it("entrega ao motor TODA coluna que o motor manda ler", () => {
    const linha = Object.fromEntries(Object.keys(COLUNAS_DA_SESSAO).map((c) => [c, "x"])) as Record<string, unknown>;
    const saida = sessaoParaMotor({ ...linha, date: new Date(2026, 9, 23, 11, 0) } as never);
    for (const coluna of Object.keys(COLUNAS_DA_SESSAO)) expect(saida).toHaveProperty(coluna);
  });

  it("em especial `faltouConta`, que foi a que se perdeu", () => {
    const s = sessaoParaMotor({ id: "s1", date: new Date(2026, 9, 23), faltouConta: false } as never);
    expect(s).toHaveProperty("faltouConta", false);
  });

  it("data em hora de PAREDE — converter no fuso do runtime desloca o dia", () => {
    expect(sessaoParaMotor({ id: "s1", date: "2026-10-23T11:00:00.000Z" } as never).date.getDate()).toBe(23);
  });
});

describe("pagamentoParaMotor", () => {
  const base = { id: "p1", amount: "200.00", date: new Date(2026, 9, 24), status: "paid" };

  it("leva `estornadoEm` — é ele que impede o estornado de quitar cobrança", () => {
    const p = pagamentoParaMotor({ ...base, estornadoEm: new Date(2026, 10, 1) });
    expect(p.estornadoEm).toBeInstanceOf(Date);
  });

  it("sem estorno, o campo é nulo — e é o nulo que deixa o pagamento quitar normalmente", () => {
    expect(pagamentoParaMotor(base).estornadoEm).toBeNull();
  });

  it("preserva a chave da cobrança, que é quem diz a QUEM o dinheiro pertence", () => {
    expect(pagamentoParaMotor({ ...base, cobrancaChave: "sessao:s1" }).cobrancaChave).toBe("sessao:s1");
  });
});
