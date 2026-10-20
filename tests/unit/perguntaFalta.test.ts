import { describe, expect, it } from "vitest";
import { tipoDaFalta, perguntaDaFalta, type TipoDaFalta } from "@/lib/perguntaFalta";

describe("tipoDaFalta — classifica o agendamento pelo formato do cadastro", () => {
  it("qualquer formato de pacote vira 'pacote', seja mensal ou quinzenal", () => {
    // O que importa para a pergunta é existir uma SEQUÊNCIA a abater — não o ritmo dela.
    for (const f of ["mensal", "mensal_completo", "mensal_fracionado", "quinzenal",
                     "quinzenal_completo", "quinzenal_fracionado", "pacote"]) {
      expect(tipoDaFalta(f)).toBe<TipoDaFalta>("pacote");
    }
  });

  it("gratuito é reconhecido", () => {
    expect(tipoDaFalta("gratuito")).toBe("gratuito");
    expect(tipoDaFalta("Gratuito")).toBe("gratuito");
  });

  it("sessão avulsa — inclusive a grafia 'sessao' que o cadastro usa", () => {
    expect(tipoDaFalta("sessao")).toBe("avulso");
    expect(tipoDaFalta("avulso")).toBe("avulso");
  });

  it("formato ausente cai em avulso, que é o default do cadastro", () => {
    expect(tipoDaFalta(null)).toBe("avulso");
    expect(tipoDaFalta(undefined)).toBe("avulso");
    expect(tipoDaFalta("")).toBe("avulso");
    expect(tipoDaFalta("   ")).toBe("avulso");
  });

  it("formato desconhecido não quebra a tela — cai em avulso", () => {
    expect(tipoDaFalta("formato-que-ninguem-criou")).toBe("avulso");
  });
});

describe("perguntaDaFalta — cada tipo tem a SUA pergunta", () => {
  it("as três perguntas são diferentes entre si", () => {
    // Se duas coincidissem, o usuário voltaria a ter que adivinhar a consequência.
    const titulos = (["gratuito", "avulso", "pacote"] as const).map((t) => perguntaDaFalta(t).titulo);
    expect(new Set(titulos).size).toBe(3);
  });

  it("gratuito pergunta sobre virar paga", () => {
    const p = perguntaDaFalta("gratuito");
    expect(p.titulo).toContain("paga");
    expect(p.explicaSim).toContain("Avulso");
    expect(p.explicaNao).toContain("gratuita");
  });

  it("avulso pergunta sobre cobrar", () => {
    const p = perguntaDaFalta("avulso");
    expect(p.titulo).toContain("Cobrar");
    expect(p.explicaNao).toContain("Gratuita");
  });

  it("pacote pergunta sobre abater da sequência", () => {
    const p = perguntaDaFalta("pacote");
    expect(p.titulo).toContain("Abater");
    expect(p.explicaSim).toContain("sequência do pacote");
    expect(p.explicaNao).toContain("inalterada");
  });

  it("toda pergunta explica o Sim E o Não — nenhuma deixa metade no escuro", () => {
    for (const t of ["gratuito", "avulso", "pacote"] as const) {
      const p = perguntaDaFalta(t);
      expect(p.titulo.length).toBeGreaterThan(10);
      expect(p.explicaSim.length).toBeGreaterThan(20);
      expect(p.explicaNao.length).toBeGreaterThan(20);
    }
  });
});
