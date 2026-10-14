import { describe, it, expect } from "vitest";
import { normalizeCadastroKind } from "@/lib/cadastro";

describe("normalizeCadastroKind (doc 41)", () => {
  it("reconhece supervisionado", () => {
    expect(normalizeCadastroKind("supervisionado")).toBe("supervisionado");
  });

  it("paciente é o padrão", () => {
    expect(normalizeCadastroKind("paciente")).toBe("paciente");
  });

  it("qualquer lixo ou ausência cai em paciente (fail-safe)", () => {
    expect(normalizeCadastroKind(null)).toBe("paciente");
    expect(normalizeCadastroKind(undefined)).toBe("paciente");
    expect(normalizeCadastroKind("")).toBe("paciente");
    expect(normalizeCadastroKind("SUPERVISIONADO")).toBe("paciente");
    expect(normalizeCadastroKind("admin")).toBe("paciente");
  });
});
