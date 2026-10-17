import { describe, it, expect } from "vitest";
import { taxaVigenteEm, liquidoDoPagamento, type VigenciaTaxa } from "@/lib/taxaCartao";

// Exemplo do doc 49: 2%/3% a partir de 01/10; 4%/5% a partir de 01/12.
const vigs: VigenciaTaxa[] = [
  { validFrom: "2026-10-01", debito: 2, credito: 3 },
  { validFrom: "2026-12-01", debito: 4, credito: 5 },
];

describe("taxaVigenteEm", () => {
  it("usa a vigência mais recente até a data", () => {
    expect(taxaVigenteEm("2026-10-15", vigs)).toEqual({ debito: 2, credito: 3 });
    expect(taxaVigenteEm("2026-11-30", vigs)).toEqual({ debito: 2, credito: 3 });
    expect(taxaVigenteEm("2026-12-01", vigs)).toEqual({ debito: 4, credito: 5 });
    expect(taxaVigenteEm("2027-03-10", vigs)).toEqual({ debito: 4, credito: 5 });
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
});
