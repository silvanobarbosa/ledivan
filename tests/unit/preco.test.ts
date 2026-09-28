import { describe, it, expect } from "vitest";
import { precoNaData, precoCobravel } from "@/lib/preco";

const d = (s: string) => new Date(s + "T00:00:00");

describe("precoNaData", () => {
  it("retorna a faixa mais recente que alcança a data", () => {
    const h = [{ valor: 100, desde: d("2024-01-01") }, { valor: 130, desde: d("2025-06-01") }];
    expect(precoNaData(h, d("2024-09-20"))).toBe(100);
    expect(precoNaData(h, d("2025-07-01"))).toBe(130);
  });
});

describe("precoCobravel (Gratuito→Mensal: preço 0 não zera cobrança)", () => {
  it("entrada 0 do período gratuito cai no valor do cadastro", () => {
    const h = [{ valor: 0, desde: d("2024-01-01") }, { valor: 130, desde: d("2026-09-01") }];
    expect(precoCobravel(h, d("2024-09-20"), 130)).toBe(130);
  });
  it("preço real (>0) prevalece sobre a reserva", () => {
    expect(precoCobravel([{ valor: 130, desde: d("2024-01-01") }], d("2024-09-20"), 200)).toBe(130);
  });
  it("sem faixa que alcance a data, usa a reserva", () => {
    expect(precoCobravel([{ valor: 130, desde: d("2026-09-01") }], d("2024-09-20"), 130)).toBe(130);
  });
  it("sem mensalidade (reserva 0), fica 0", () => {
    expect(precoCobravel([{ valor: 0, desde: d("2024-01-01") }], d("2024-09-20"), 0)).toBe(0);
  });
});
