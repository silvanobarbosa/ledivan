import { describe, it, expect } from "vitest";
import { receitaSaudeFields, receitaSaudeCopyText } from "@/lib/receitaSaude";

describe("receitaSaudeFields", () => {
  const patient = { name: "Maria Silva", cpf: "12345678909" };

  it("formata CPF do beneficiário e valor/data", () => {
    const f = receitaSaudeFields({ amount: "150.00", date: "2026-08-30T14:00:00Z" }, patient);
    expect(f.beneficiaryCpf).toBe("123.456.789-09");
    expect(f.amount).toBe("150.00");
    expect(f.amountBRL).toContain("150,00");
    expect(f.date).toBe("2026-08-30");
    expect(f.missing).toEqual([]);
  });

  it("usa o responsável como pagador quando há CPF de responsável", () => {
    const f = receitaSaudeFields(
      { amount: 200, date: new Date("2026-01-10") },
      { name: "João (10 anos)", cpf: "11144477735", guardianName: "Ana Mãe", guardianCpf: "98765432100" },
    );
    expect(f.beneficiaryName).toBe("João (10 anos)");
    expect(f.payerName).toBe("Ana Mãe");
    expect(f.payerCpf).toBe("987.654.321-00");
  });

  it("cai no próprio paciente como pagador quando não há responsável", () => {
    const f = receitaSaudeFields({ amount: 100, date: new Date("2026-05-05") }, patient);
    expect(f.payerName).toBe("Maria Silva");
    expect(f.payerCpf).toBe("123.456.789-09");
  });

  it("acusa campos faltando (CPF do paciente e valor)", () => {
    const f = receitaSaudeFields({ amount: 0, date: new Date() }, { name: "Sem CPF" });
    expect(f.missing).toContain("CPF do paciente");
    expect(f.missing).toContain("CPF do pagador");
    expect(f.missing).toContain("Valor");
  });

  it("descrição padrão configurável", () => {
    const f = receitaSaudeFields({ amount: 100, date: new Date() }, patient, "Sessão de terapia");
    expect(f.description).toBe("Sessão de terapia");
  });

  it("copyText inclui os campos-chave", () => {
    const f = receitaSaudeFields({ amount: 150, date: new Date("2026-08-30") }, patient);
    const t = receitaSaudeCopyText(f);
    expect(t).toContain("CPF do beneficiário: 123.456.789-09");
    expect(t).toContain("Beneficiário: Maria Silva");
  });
});
