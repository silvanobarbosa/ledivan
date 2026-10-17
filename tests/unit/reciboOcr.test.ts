import { describe, it, expect } from "vitest";
import { lerReciboTexto } from "@/lib/reciboOcr";

describe("lerReciboTexto", () => {
  it("prefere a linha de TOTAL (ignora SUBTOTAL)", () => {
    const t = [
      "PADARIA PAO QUENTE",
      "Pao frances      5,00",
      "Leite            8,90",
      "SUBTOTAL        13,90",
      "TOTAL R$        13,90",
    ].join("\n");
    const r = lerReciboTexto(t);
    expect(r.valor).toBe(13.9);
    expect(r.descricao).toBe("PADARIA PAO QUENTE");
  });

  it("lê valor com milhar e data dd/mm/aaaa", () => {
    const t = "LOJA XYZ\nData: 17/10/2026\nVALOR A PAGAR: R$ 1.234,56";
    const r = lerReciboTexto(t);
    expect(r.valor).toBe(1234.56);
    expect(r.dataISO).toBe("2026-10-17");
  });

  it("normaliza ano de 2 dígitos", () => {
    expect(lerReciboTexto("Compra 03/02/26\nTotal 50,00").dataISO).toBe("2026-02-03");
  });

  it("sem linha de total, pega o maior valor", () => {
    const r = lerReciboTexto("Item A 10,00\nItem B 42,30\nItem C 7,00");
    expect(r.valor).toBe(42.3);
  });

  it("não inventa o que não acha", () => {
    const r = lerReciboTexto("texto sem numeros nem datas uteis");
    expect(r.valor).toBeUndefined();
    expect(r.dataISO).toBeUndefined();
  });

  it("ignora data impossível", () => {
    expect(lerReciboTexto("venc 45/13/2026 total 9,99").dataISO).toBeUndefined();
  });

  it("aceita data ISO", () => {
    expect(lerReciboTexto("emitido 2026-03-09\ntotal 15,00").dataISO).toBe("2026-03-09");
  });
});
