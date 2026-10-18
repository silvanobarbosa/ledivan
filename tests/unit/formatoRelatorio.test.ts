import { describe, it, expect } from "vitest";
import { categoriaFormato, vencimentoRelatorio, valorRelatorio } from "@/lib/formatoRelatorio";

describe("categoriaFormato", () => {
  it("as seis categorias", () => {
    expect(categoriaFormato("gratuito", null)).toMatchObject({ label: "Gratuito", categoria: "gratuito" });
    expect(categoriaFormato("sessao", null)).toMatchObject({ label: "Avulso", categoria: "avulso" });
    expect(categoriaFormato("mensal", "completo")).toMatchObject({ label: "Mensal Completo", categoria: "mensal_completo" });
    expect(categoriaFormato("mensal", "fragmentado")).toMatchObject({ label: "Mensal Fracionado", categoria: "mensal_fracionado" });
    expect(categoriaFormato("quinzenal", "completo")).toMatchObject({ label: "Quinzenal Completo", categoria: "quinzenal_completo" });
    expect(categoriaFormato("quinzenal", "fragmentado")).toMatchObject({ label: "Quinzenal Fracionado", categoria: "quinzenal_fracionado" });
  });
  it("1ª/última sessão do pacote contam como Mensal", () => {
    expect(categoriaFormato("primeira_pacote", "completo").categoria).toBe("mensal_completo");
    expect(categoriaFormato("ultima_pacote", "fragmentado").categoria).toBe("mensal_fracionado");
  });
});

describe("vencimentoRelatorio", () => {
  it("dia / 1ª / última", () => {
    expect(vencimentoRelatorio("mensal", 10)).toBe("dia 10");
    expect(vencimentoRelatorio("quinzenal", 5)).toBe("dia 5");
    expect(vencimentoRelatorio("primeira_pacote", null)).toBe("Primeira sessão do pacote");
    expect(vencimentoRelatorio("ultima_pacote", null)).toBe("Última sessão do pacote");
    expect(vencimentoRelatorio("sessao", null)).toBe("—");
  });
});

describe("valorRelatorio", () => {
  it("por categoria", () => {
    expect(valorRelatorio("gratuito", 100, 4)).toBe("-");
    expect(valorRelatorio("avulso", 150, null)).toBe(valorRelatorio("avulso", 150, null)); // formatBRL(150)
    expect(valorRelatorio("mensal_completo", 100, 4)).toContain("4 ×");
    expect(valorRelatorio("mensal_fracionado", 100, 4)).toContain("por sessão");
    expect(valorRelatorio("quinzenal_completo", 50, 8)).toContain("8 ×");
  });
  it("completo sem tamanho cai no valor da sessão", () => {
    expect(valorRelatorio("mensal_completo", 100, null)).not.toContain("×");
  });
});
