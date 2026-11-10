import { describe, expect, it } from "vitest";
import { comoHtml, ehHtml, escaparHtml, somenteTexto } from "@/lib/textoRico";
import { limparHtmlDoDocumento } from "@/lib/htmlDoDocumento";

describe("comoHtml: o documento antigo entra no editor novo", () => {
  it("texto puro vira uma linha por div", () => {
    expect(comoHtml("Primeira\nSegunda")).toBe("<div>Primeira</div><div>Segunda</div>");
  });

  it("linha em branco continua em branco — o respiro do texto não se perde", () => {
    expect(comoHtml("A\n\nB")).toBe("<div>A</div><div><br></div><div>B</div>");
  });

  it("o que já é HTML passa intacto", () => {
    const html = '<div style="text-align:center">Oi</div>';
    expect(comoHtml(html)).toBe(html);
  });

  it("sinal de menor no meio da frase é texto, não marcação", () => {
    expect(ehHtml("a sessão das 9 < a das 10")).toBe(false);
    expect(comoHtml("a < b")).toBe("<div>a &lt; b</div>");
  });

  it("vazio não vira div vazia", () => {
    expect(comoHtml("")).toBe("");
    expect(comoHtml("   \n ")).toBe("");
  });

  it("escapar não deixa o texto do usuário virar tag", () => {
    expect(escaparHtml('<script>"x"&y')).toBe("&lt;script&gt;&quot;x&quot;&amp;y");
  });
});

describe("somenteTexto: o rótulo da lista e a conferência de 'está preenchido?'", () => {
  it("tira a marcação e devolve as quebras", () => {
    expect(somenteTexto("<div>Um</div><div>Dois</div>")).toBe("Um\nDois");
  });

  it("campo só com quebra de linha NÃO está preenchido", () => {
    expect(somenteTexto("<div><br></div>").trim()).toBe("");
  });

  it("devolve a entidade ao caractere", () => {
    expect(somenteTexto("<div>a &lt; b &amp; c</div>")).toBe("a < b & c");
  });

  it("texto puro atravessa sem perder nada", () => {
    expect(somenteTexto("Relatório de março")).toBe("Relatório de março");
  });
});

describe("limparHtmlDoDocumento: o que o servidor aceita guardar", () => {
  it("guarda a formatação que a barra aplica", () => {
    const html = '<div style="text-align:center"><span style="color:#dc2626;font-size:large">Oi</span></div>';
    const limpo = limparHtmlDoDocumento(html);
    expect(limpo).toContain("text-align:center");
    expect(limpo).toContain("#dc2626");
    expect(limpo).toContain("font-size:large");
  });

  it("guarda negrito, itálico e lista", () => {
    const limpo = limparHtmlDoDocumento("<ul><li><b>um</b> <i>dois</i></li></ul>");
    expect(limpo).toBe("<ul><li><b>um</b> <i>dois</i></li></ul>");
  });

  it("some com script, mesmo com o texto dentro", () => {
    expect(limparHtmlDoDocumento("<div>antes</div><script>alert(1)</script>")).toBe("<div>antes</div>");
  });

  it("some com atributo de evento e com imagem", () => {
    expect(limparHtmlDoDocumento('<img src="x" onerror="alert(1)">')).toBe("");
    expect(limparHtmlDoDocumento('<div onclick="alert(1)">ok</div>')).toBe("<div>ok</div>");
  });

  it("some com link — documento não tem link para clicar", () => {
    expect(limparHtmlDoDocumento('<a href="javascript:alert(1)">x</a>')).toBe("x");
  });

  it("estilo fora da barra não passa", () => {
    const limpo = limparHtmlDoDocumento('<div style="position:fixed;background:url(http://x/y)">x</div>');
    expect(limpo).not.toContain("position");
    expect(limpo).not.toContain("url(");
  });

  it("texto puro atravessa sem virar marcação", () => {
    expect(limparHtmlDoDocumento("Declaração de comparecimento")).toBe("Declaração de comparecimento");
  });
});
