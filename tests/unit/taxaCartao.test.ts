import { describe, it, expect } from "vitest";
import { taxaVigenteEm, liquidoDoPagamento, type VigenciaTaxa, FORMAS_COM_TAXA } from "@/lib/taxaCartao";

// Exemplo do doc 49: 2%/3% a partir de 01/10; 4%/5% a partir de 01/12.
const vigs: VigenciaTaxa[] = [
  { validFrom: "2026-10-01", debito: 2, credito: 3 },
  { validFrom: "2026-12-01", debito: 4, credito: 5 },
];

describe("taxaVigenteEm", () => {
  it("usa a vigência mais recente até a data", () => {
    expect(taxaVigenteEm("2026-10-15", vigs)).toMatchObject({ debito: 2, credito: 3 });
    expect(taxaVigenteEm("2026-11-30", vigs)).toMatchObject({ debito: 2, credito: 3 });
    expect(taxaVigenteEm("2026-12-01", vigs)).toMatchObject({ debito: 4, credito: 5 });
    expect(taxaVigenteEm("2027-03-10", vigs)).toMatchObject({ debito: 4, credito: 5 });
  });
  it("pagamento anterior à primeira vigência não tem taxa", () => {
    expect(taxaVigenteEm("2026-09-20", vigs)).toBeNull();
  });
});

describe("liquidoDoPagamento", () => {
  it("desconta a taxa vigente na data do pagamento (não a atual)", () => {
    expect(liquidoDoPagamento(100, "credito", "2026-10-15", vigs)).toBe(97); // 3%
    expect(liquidoDoPagamento(100, "credito", "2026-12-15", vigs)).toBe(95); // 5%
    expect(liquidoDoPagamento(100, "debito", "2026-10-15", vigs)).toBe(98);  // 2%
    expect(liquidoDoPagamento(150, "credito", "2026-10-20", vigs)).toBe(145.5); // 3% de 150
  });
  it("Pix/dinheiro/sem forma não descontam", () => {
    expect(liquidoDoPagamento(100, "pix", "2026-10-15", vigs)).toBe(100);
    expect(liquidoDoPagamento(100, "dinheiro", "2026-10-15", vigs)).toBe(100);
    expect(liquidoDoPagamento(100, null, "2026-10-15", vigs)).toBe(100);
  });
  it("pagamento antes de qualquer vigência fica bruto", () => {
    expect(liquidoDoPagamento(100, "credito", "2026-09-20", vigs)).toBe(100);
  });
  it("sem vigências cadastradas, tudo bruto", () => {
    expect(liquidoDoPagamento(100, "credito", "2026-10-15", [])).toBe(100);
  });

  it("crédito parcelado 2x/3x usa a taxa própria (doc 50)", () => {
    const vs: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 2, credito: 5, credito2x: 7, credito3x: 9 }];
    expect(liquidoDoPagamento(100, "credito", "2026-03-10", vs)).toBe(95);    // à vista 5%
    expect(liquidoDoPagamento(100, "credito_2x", "2026-03-10", vs)).toBe(93); // 2x 7%
    expect(liquidoDoPagamento(100, "credito_3x", "2026-03-10", vs)).toBe(91); // 3x 9%
  });

  it("parcelado sem taxa configurada fica bruto", () => {
    const vs: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 2, credito: 5 }]; // sem 2x/3x
    expect(liquidoDoPagamento(100, "credito_2x", "2026-03-10", vs)).toBe(100);
  });
});

/**
 * Doc 53: crédito 4x e 5x. O teste que importa não é "4x desconta": é que a lista de formas com
 * taxa e o mapa de percentuais NÃO PODEM DIVERGIR — divergir significa cobrar taxa de quem não
 * tem, ou deixar de descontar de quem tem, e em silêncio.
 */
describe("crédito 4x e 5x (doc 53)", () => {
  const vig: VigenciaTaxa[] = [{
    validFrom: "2026-01-01",
    debito: 1, credito: 2, credito2x: 3, credito3x: 4, credito4x: 5, credito5x: 6,
  }];

  it("cada parcela desconta o SEU percentual", () => {
    expect(liquidoDoPagamento(100, "credito_4x", "2026-06-10", vig)).toBe(95);
    expect(liquidoDoPagamento(100, "credito_5x", "2026-06-10", vig)).toBe(94);
  });

  it("as parcelas antigas continuam no percentual delas", () => {
    expect(liquidoDoPagamento(100, "debito", "2026-06-10", vig)).toBe(99);
    expect(liquidoDoPagamento(100, "credito", "2026-06-10", vig)).toBe(98);
    expect(liquidoDoPagamento(100, "credito_2x", "2026-06-10", vig)).toBe(97);
    expect(liquidoDoPagamento(100, "credito_3x", "2026-06-10", vig)).toBe(96);
  });

  it("vigência antiga, sem 4x/5x cadastrados, não inventa desconto", () => {
    // Taxa criada antes do doc 53: os campos novos chegam null. Descontar algo seria errado;
    // o valor tem que sair inteiro.
    const antiga: VigenciaTaxa[] = [{ validFrom: "2026-01-01", debito: 1, credito: 2 }];
    expect(liquidoDoPagamento(100, "credito_4x", "2026-06-10", antiga)).toBe(100);
    expect(liquidoDoPagamento(100, "credito_5x", "2026-06-10", antiga)).toBe(100);
  });

  it("formas sem cartão seguem pelo bruto", () => {
    for (const forma of ["pix", "cash", "transfer"]) {
      expect(liquidoDoPagamento(100, forma, "2026-06-10", vig)).toBe(100);
    }
  });

  it("a lista FORMAS_COM_TAXA cobre exatamente as formas de cartão — nem mais, nem menos", () => {
    expect([...FORMAS_COM_TAXA].sort()).toEqual(
      ["credito", "credito_2x", "credito_3x", "credito_4x", "credito_5x", "debito"],
    );
  });

  it("toda forma com taxa realmente desconta — nenhuma entra na lista e fica inerte", () => {
    // Pega o caso de alguém incluir a forma na lista e esquecer o percentual no mapa.
    for (const forma of FORMAS_COM_TAXA) {
      expect(liquidoDoPagamento(100, forma, "2026-06-10", vig)).toBeLessThan(100);
    }
  });
});
