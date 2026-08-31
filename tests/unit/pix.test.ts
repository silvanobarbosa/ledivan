import { describe, it, expect } from "vitest";
import { buildPixCode } from "@/lib/pix";

// Extrai o payload sem os 4 hex finais e o próprio CRC informado.
function splitCrc(code: string) {
  return { body: code.slice(0, -4), crc: code.slice(-4) };
}

// Reimplementação independente do CRC-16/CCITT-FALSE para conferir o do gerador.
function crc16(p: string): string {
  let c = 0xffff;
  for (let i = 0; i < p.length; i++) {
    c ^= p.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) { c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1; c &= 0xffff; }
  }
  return c.toString(16).toUpperCase().padStart(4, "0");
}

describe("buildPixCode", () => {
  const base = { key: "dev@reverblabs.com.br", name: "Silvano Barbosa", city: "Sao Paulo" };

  it("começa com o Payload Format Indicator 000201", () => {
    expect(buildPixCode(base).startsWith("000201")).toBe(true);
  });

  it("inclui a GUI do Pix e a chave", () => {
    const code = buildPixCode(base);
    expect(code).toContain("BR.GOV.BCB.PIX");
    expect(code).toContain(base.key);
  });

  it("o CRC final confere com o CRC-16/CCITT-FALSE do corpo", () => {
    const { body, crc } = splitCrc(buildPixCode(base));
    expect(crc).toBe(crc16(body));
  });

  it("inclui o valor formatado quando amount > 0 (campo 54)", () => {
    const code = buildPixCode({ ...base, amount: 150 });
    expect(code).toContain("5406150.00");
  });

  it("omite o campo de valor quando amount ausente ou zero", () => {
    expect(buildPixCode(base)).not.toContain("5406");
    expect(buildPixCode({ ...base, amount: 0 })).not.toContain("5406");
  });

  it("sanitiza acentos do nome/cidade (só ASCII maiúsculo)", () => {
    const code = buildPixCode({ ...base, name: "José Antônio", city: "Brasília" });
    expect(code).toContain("JOSE ANTONIO");
    expect(code).toContain("BRASILIA");
    expect(code).not.toMatch(/[áéíóúãõâêôçÁ]/);
  });

  it("é determinístico (mesma entrada → mesmo código)", () => {
    expect(buildPixCode(base)).toBe(buildPixCode(base));
  });
});
