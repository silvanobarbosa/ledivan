import { describe, it, expect } from "vitest";
import { apenasCpf, cpfBR, montarRecibo } from "@/lib/recibo";

/**
 * O CPF de quem pagou (onda 4, documento de 17/09).
 *
 * Duas regras que não podem se perder: o banco guarda só os dígitos, e o papel imprime pontuado.
 * Se as duas pontas usassem a mesma string crua, o recibo sairia com a pontuação que cada pessoa
 * digitou — ou sem nenhuma.
 */
describe("o CPF que entra", () => {
  it("guarda só os dígitos, venha como vier", () => {
    expect(apenasCpf("123.456.789-00")).toBe("12345678900");
    expect(apenasCpf("123 456 789 00")).toBe("12345678900");
    expect(apenasCpf("12345678900")).toBe("12345678900");
  });

  it("campo em branco (ou só pontuação) vira null, não string vazia", () => {
    expect(apenasCpf("")).toBeNull();
    expect(apenasCpf("   ")).toBeNull();
    expect(apenasCpf("...-")).toBeNull();
    expect(apenasCpf(null)).toBeNull();
    expect(apenasCpf(undefined)).toBeNull();
  });

  it("não guarda mais que 11 dígitos", () => {
    expect(apenasCpf("1234567890099999")).toBe("12345678900");
  });
});

describe("o CPF que sai", () => {
  it("imprime pontuado quando está completo", () => {
    expect(cpfBR("12345678900")).toBe("123.456.789-00");
    expect(cpfBR("123.456.789-00")).toBe("123.456.789-00");
  });

  it("número incompleto sai como veio — não se inventa dígito num recibo", () => {
    expect(cpfBR("1234567")).toBe("1234567");
  });

  it("sem CPF não sobra nada para o texto encaixar", () => {
    expect(cpfBR(null)).toBe("");
    expect(cpfBR("")).toBe("");
  });
});

describe("o CPF dentro do recibo", () => {
  const base = {
    responsavel: "Maria de Souza",
    paciente: "João de Souza",
    datas: [new Date(2026, 8, 3, 12)],
    valorTotal: 520,
    dataPagamento: new Date(2026, 8, 5, 12),
    terapeuta: "Ledivan Barbosa",
    descricao: "psicoterapia" as const,
  };

  it("sai pontuado mesmo tendo sido guardado só em dígitos", () => {
    const texto = montarRecibo({ ...base, responsavelCpf: "12345678900", terapeutaCpf: "98765432100" });
    expect(texto).toContain("CPF 123.456.789-00");
    expect(texto).toContain("CPF: 987.654.321-00");
  });

  it("sem CPF do responsável, a vírgula do CPF não aparece", () => {
    const texto = montarRecibo({ ...base, responsavelCpf: null, terapeutaCpf: "98765432100" });
    expect(texto).toContain("Recebi de Maria de Souza, o valor");
    expect(texto).not.toContain("CPF —");
  });
});
