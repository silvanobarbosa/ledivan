import { describe, expect, it } from "vitest";
import { aceitaArquivo, dimensaoReduzida, LIMITE_ANEXOS, LADO_MAXIMO, TAMANHO_MAXIMO_BYTES } from "@/lib/anexoImagem";

const img = (size: number, type = "image/png") => ({ type, size });

describe("aceitaArquivo", () => {
  it("aceita um print comum", () => {
    expect(aceitaArquivo(img(300_000), 0).ok).toBe(true);
  });

  it("recusa quem já atingiu o limite, dizendo como resolver", () => {
    const r = aceitaArquivo(img(1000), LIMITE_ANEXOS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("Remova um");
  });

  it("recusa arquivo que não é imagem", () => {
    expect(aceitaArquivo({ type: "application/pdf", size: 1000 }, 0).ok).toBe(false);
    expect(aceitaArquivo({ type: "video/mp4", size: 1000 }, 0).ok).toBe(false);
    expect(aceitaArquivo({ type: "", size: 1000 }, 0).ok).toBe(false);
  });

  it("recusa arquivo vazio", () => {
    expect(aceitaArquivo(img(0), 0).ok).toBe(false);
  });

  it("recusa imagem gigante sugerindo o print em vez da foto original", () => {
    const r = aceitaArquivo(img(TAMANHO_MAXIMO_BYTES + 1), 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("print");
  });

  it("toda recusa explica o motivo — nenhuma volta vazia", () => {
    const casos = [
      aceitaArquivo(img(1000), LIMITE_ANEXOS),
      aceitaArquivo({ type: "text/plain", size: 10 }, 0),
      aceitaArquivo(img(0), 0),
      aceitaArquivo(img(TAMANHO_MAXIMO_BYTES + 1), 0),
    ];
    for (const c of casos) {
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.motivo.length).toBeGreaterThan(10);
    }
  });
});

describe("dimensaoReduzida", () => {
  it("reduz pelo maior lado, mantendo a proporção", () => {
    expect(dimensaoReduzida(2560, 1440)).toEqual({ largura: 1280, altura: 720 });
    expect(dimensaoReduzida(1080, 2400)).toEqual({ largura: 576, altura: 1280 });
  });

  it("NÃO amplia imagem já pequena — ampliar só gera peso", () => {
    expect(dimensaoReduzida(400, 300)).toEqual({ largura: 400, altura: 300 });
  });

  it("imagem exatamente no limite fica como está", () => {
    expect(dimensaoReduzida(LADO_MAXIMO, 600)).toEqual({ largura: LADO_MAXIMO, altura: 600 });
  });

  it("nunca devolve lado zero, mesmo em proporção extrema", () => {
    // Uma faixa 4000x3 reduziria a altura para 0,96 — arredondar para 0 quebraria o canvas.
    const d = dimensaoReduzida(4000, 3);
    expect(d.largura).toBe(1280);
    expect(d.altura).toBeGreaterThanOrEqual(1);
  });

  it("entrada inválida não quebra", () => {
    expect(dimensaoReduzida(0, 0).largura).toBeGreaterThanOrEqual(1);
    expect(dimensaoReduzida(NaN, NaN).altura).toBeGreaterThanOrEqual(1);
  });
});
