import { describe, it, expect } from "vitest";
import { dataDeFormulario, valorParaCampoBR } from "@/lib/dataForm";

describe("dataDeFormulario", () => {
  it("campo vazio vira null, não 1970", () => {
    expect(dataDeFormulario("")).toBeNull();
    expect(dataDeFormulario("   ")).toBeNull();
    expect(dataDeFormulario(null)).toBeNull();
    expect(dataDeFormulario(undefined)).toBeNull();
  });

  it("texto que não é data vira null", () => {
    expect(dataDeFormulario("amanhã")).toBeNull();
    expect(dataDeFormulario("2026-13-45")).toBeNull();
  });

  it("mantém o DIA escolhido em fuso negativo", () => {
    // O bug que isto protege: new Date("2026-09-09") é meia-noite UTC, que em UTC-3 é dia 08.
    const d = dataDeFormulario("2026-09-09");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(8); // setembro
    expect(d!.getDate()).toBe(9);
  });

  it("ancora ao meio-dia local", () => {
    expect(dataDeFormulario("2026-01-31")!.getHours()).toBe(12);
  });
});

describe("valorParaCampoBR", () => {
  it("troca o ponto decimal por vírgula", () => {
    expect(valorParaCampoBR("180.00")).toBe("180,00");
    expect(valorParaCampoBR("0.50")).toBe("0,50");
  });

  it("vazio e nulo continuam vazios", () => {
    expect(valorParaCampoBR("")).toBe("");
    expect(valorParaCampoBR(null)).toBe("");
    expect(valorParaCampoBR(undefined)).toBe("");
  });
});
