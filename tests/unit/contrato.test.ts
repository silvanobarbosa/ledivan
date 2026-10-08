import { describe, it, expect } from "vitest";
import { montarContrato } from "@/lib/contrato";

describe("montarContrato", () => {
  const base = { analistaNome: "Gisele Barbosa", analistaCpf: "123.456.789-00", descricaoAtendimento: "atendimentos psicanalíticos", pacienteNome: "João Silva", pacienteNascimento: new Date(2015, 5, 10), responsavelNome: "Maria Silva", responsavelCpf: "987.654.321-00", valorSessao: 120, reajusteMeses: 6 };
  it("preenche nome, CPF, valor e reajuste do que existe", () => {
    const t = montarContrato(base);
    expect(t).toContain("Nome: Gisele Barbosa");
    expect(t).toContain("João Silva");
    expect(t).toContain("Maria Silva");
    expect(t).toContain("R$ 120,00");
    expect(t).toContain("a cada 6 meses");
  });
  it("deixa [campo] onde não há dado", () => {
    const t = montarContrato({ ...base, analistaCpf: null, responsavelNome: null });
    expect(t).toContain("[CPF]");
    expect(t).toContain("[Nome Completo do Responsável]");
  });
  it("calcula idade da data de nascimento", () => {
    const t = montarContrato({ ...base, pacienteNascimento: new Date(2010, 0, 1) });
    expect(t).toMatch(/Idade: 1[0-9] anos/);
  });
});
