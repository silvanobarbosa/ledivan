import { describe, it, expect } from "vitest";
import { montarContrato } from "@/lib/contrato";

describe("montarContrato", () => {
  // Paciente criança (nascido 2015 → < 18): regra de menor, responsável do cadastro no Responsável 1.
  const base = { analistaNome: "Gisele Barbosa", analistaCpf: "123.456.789-00", descricaoAtendimento: "atendimentos psicanalíticos", pacienteNome: "João Silva", pacienteNascimento: new Date(2015, 5, 10), pacienteCpf: "111.222.333-44", responsavelNome: "Maria Silva", responsavelCpf: "987.654.321-00", valorSessao: 120, reajusteMeses: 6 };
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

  // Doc 23 — título, bloco paciente, responsáveis por idade.
  it("título é só 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE' (sem a linha de infantil/adolescente)", () => {
    const t = montarContrato(base);
    expect(t.startsWith("CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE\n")).toBe(true);
    expect(t).not.toContain("Atendimento Infantil");
  });
  it("bloco do paciente usa 'Nome:', não 'Nome da Criança / Adolescente:'", () => {
    const t = montarContrato(base);
    expect(t).toContain("PACIENTE (BENEFICIÁRIO):\nNome: João Silva");
    expect(t).not.toContain("Nome da Criança");
  });
  it("menor de 18: responsável do cadastro vira Responsável 1; Responsável 2 fica vazio", () => {
    const t = montarContrato(base); // João, 2015
    expect(t).toContain("Nome do Responsável 1: Maria Silva — CPF: 987.654.321-00");
    expect(t).toContain("Nome do Responsável 2: [Nome Completo do Responsável] — CPF: [CPF]");
  });
  it("maior de 18 SEM responsável: o próprio paciente é o Responsável 1; o 2 fica vazio", () => {
    const t = montarContrato({ ...base, pacienteNascimento: new Date(1990, 0, 1), responsavelNome: null, responsavelCpf: null });
    expect(t).toContain("Nome do Responsável 1: João Silva — CPF: 111.222.333-44");
    expect(t).toContain("Nome do Responsável 2: [Nome Completo do Responsável] — CPF: [CPF]");
  });
  it("maior de 18 COM responsável: responsável no 1, paciente no 2", () => {
    const t = montarContrato({ ...base, pacienteNascimento: new Date(1990, 0, 1) });
    expect(t).toContain("Nome do Responsável 1: Maria Silva — CPF: 987.654.321-00");
    expect(t).toContain("Nome do Responsável 2: João Silva — CPF: 111.222.333-44");
  });
});
