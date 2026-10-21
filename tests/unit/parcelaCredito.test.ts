import { describe, expect, it } from "vitest";
import { metodoDoCredito, parcelasDoMetodo, ehCredito, rotuloDaParcela, PARCELAS_CREDITO } from "@/lib/parcelaCredito";
import { FORMAS_COM_TAXA } from "@/lib/taxaCartao";

describe("metodoDoCredito — a string que vai para o banco", () => {
  it("à vista é 'credito', sem sufixo — como era antes do 2x existir", () => {
    // Mudar isso renomearia a forma de todo pagamento à vista já gravado.
    expect(metodoDoCredito(1)).toBe("credito");
  });

  it("parcelado vira credito_Nx", () => {
    expect(metodoDoCredito(2)).toBe("credito_2x");
    expect(metodoDoCredito(5)).toBe("credito_5x");
  });

  it("parcela fora da faixa cai em à vista em vez de inventar forma", () => {
    // Uma string como "credito_9x" não existe no enum: gravar quebraria o insert.
    for (const n of [0, -1, 6, 12, NaN]) expect(metodoDoCredito(n)).toBe("credito");
  });

  it("TODA parcela oferecida gera uma forma que o motor de taxa conhece", () => {
    // É o acordo entre tela e cálculo: oferecer 4x e o motor não saber descontar seria pior
    // do que não oferecer.
    for (const n of PARCELAS_CREDITO) {
      expect(FORMAS_COM_TAXA).toContain(metodoDoCredito(n));
    }
  });
});

describe("parcelasDoMetodo — o caminho de volta", () => {
  it("reconhece crédito à vista e parcelado", () => {
    expect(parcelasDoMetodo("credito")).toBe(1);
    expect(parcelasDoMetodo("credito_3x")).toBe(3);
  });

  it("não confunde outras formas com crédito", () => {
    for (const m of ["pix", "debito", "cash", "transfer", "card", "", null, undefined]) {
      expect(parcelasDoMetodo(m)).toBeNull();
      expect(ehCredito(m)).toBe(false);
    }
  });

  it("débito NÃO é crédito, mesmo sendo cartão", () => {
    // Os dois sofrem taxa, mas só o crédito parcela.
    expect(ehCredito("debito")).toBe(false);
  });

  it("forma de crédito fora da faixa oferecida não volta como parcela válida", () => {
    expect(parcelasDoMetodo("credito_9x")).toBeNull();
  });

  it("ida e volta fecham para toda parcela", () => {
    for (const n of PARCELAS_CREDITO) {
      expect(parcelasDoMetodo(metodoDoCredito(n))).toBe(n);
    }
  });
});

describe("rotuloDaParcela", () => {
  it("1 é 'à vista'; o resto é Nx", () => {
    expect(rotuloDaParcela(1)).toBe("à vista");
    expect(rotuloDaParcela(4)).toBe("4x");
  });
});
