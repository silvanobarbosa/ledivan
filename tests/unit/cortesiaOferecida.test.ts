import { describe, expect, it } from "vitest";
import { podeSerCortesia } from "@/lib/cortesia";

describe("podeSerCortesia — onde a pergunta aparece (doc 54, item 03)", () => {
  it("mensal e quinzenal com pacote completo", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo" })).toBe(true);
    expect(podeSerCortesia({ formato: "quinzenal", pacoteTipo: "completo" })).toBe(true);
  });

  it("pacote sem tipo informado é COMPLETO, como no motor de cobranças", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: null })).toBe(true);
  });

  it("fracionado fica de fora — o mês é a unidade dele, não há sequência fechada", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "fragmentado" })).toBe(false);
    expect(podeSerCortesia({ formato: "quinzenal", pacoteTipo: "fragmentado" })).toBe(false);
  });

  it("quem não fecha por pacote não tem vaga a abrir", () => {
    for (const formato of ["sessao", "avulso", "gratuito", "primeira_pacote", "ultima_pacote", ""]) {
      expect(podeSerCortesia({ formato, pacoteTipo: "completo" })).toBe(false);
    }
    expect(podeSerCortesia({ formato: null })).toBe(false);
  });

  it("devolutiva fica de fora: ela já tem a própria escolha de abater do pacote", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo", sessionKind: "devolutiva" })).toBe(false);
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo", sessionKind: "consulta" })).toBe(true);
  });
});
