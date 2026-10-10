import { describe, it, expect } from "vitest";
import { montarContrato } from "@/lib/contrato";

describe("montarContrato", () => {
  // Paciente criança (nascido 2015 → < 18): regra de menor, responsável do cadastro no Responsável 1.
  const base = { analistaNome: "Gisele Barbosa", analistaCpf: "123.456.789-00", descricaoAtendimento: "atendimentos psicanalíticos", pacienteNome: "João Silva", pacienteNascimento: new Date(2015, 5, 10), pacienteCpf: "111.222.333-44", responsavelNome: "Maria Silva", responsavelCpf: "987.654.321-00", valorSessao: 120, reajusteMeses: 6, pacienteEndereco: "Rua das Flores, 100 — Centro", responsavelTelefone: "(11) 99999-0000", pacienteTelefone: "(11) 88888-0000", duracaoMaxMin: 50, recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: true }, horarioFixo: new Date(2026, 9, 6, 15, 0), formatoPagamento: "mensal", diaPagamento: 5, diaPagamento2: null, horasAntesPagamento: null };
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
  // Doc 25: quando o Responsável 2 fica vazio, a LINHA dele não aparece no contrato (antes saía o placeholder).
  it("menor de 18: responsável do cadastro vira Responsável 1; a linha do Responsável 2 NÃO aparece", () => {
    const t = montarContrato(base); // João, 2015
    expect(t).toContain("Nome do Responsável 1: Maria Silva — CPF: 987.654.321-00");
    expect(t).not.toContain("Nome do Responsável 2");
  });
  it("maior de 18 SEM responsável: o próprio paciente é o Responsável 1; a linha do Responsável 2 NÃO aparece", () => {
    const t = montarContrato({ ...base, pacienteNascimento: new Date(1990, 0, 1), responsavelNome: null, responsavelCpf: null });
    expect(t).toContain("Nome do Responsável 1: João Silva — CPF: 111.222.333-44");
    expect(t).not.toContain("Nome do Responsável 2");
  });
  it("maior de 18 COM responsável: responsável no 1, paciente no 2 (a linha aparece)", () => {
    const t = montarContrato({ ...base, pacienteNascimento: new Date(1990, 0, 1) });
    expect(t).toContain("Nome do Responsável 1: Maria Silva — CPF: 987.654.321-00");
    expect(t).toContain("Nome do Responsável 2: João Silva — CPF: 111.222.333-44");
  });

  // Doc 25 — endereço e telefone do CONTRATANTE preenchidos do cadastro.
  it("endereço do contratante é o endereço do paciente", () => {
    const t = montarContrato(base);
    expect(t).toContain("Endereço: Rua das Flores, 100 — Centro");
  });
  it("telefone de contato é o do responsável", () => {
    const t = montarContrato(base);
    expect(t).toContain("Telefone / E-mail de Contato: (11) 99999-0000");
  });
  it("sem telefone do responsável, usa o do paciente", () => {
    const t = montarContrato({ ...base, responsavelTelefone: null });
    expect(t).toContain("Telefone / E-mail de Contato: (11) 88888-0000");
  });
  it("sem endereço cadastrado, mantém o placeholder", () => {
    const t = montarContrato({ ...base, pacienteEndereco: null });
    expect(t).toContain("Endereço: [Endereço Residencial Completo]");
  });

  // Doc 26 — enquadre dinâmico (duração, frequência, horário fixo).
  it("3.1 duração usa 'até X minutos' do maior tempo cadastrado", () => {
    expect(montarContrato({ ...base, duracaoMaxMin: 60 })).toContain("terão a duração de até 60 minutos");
  });
  it("3.1 sem duração cadastrada mantém o placeholder", () => {
    expect(montarContrato({ ...base, duracaoMaxMin: null })).toContain("até [ex: 45 a 50 minutos]");
  });
  it("3.1 frequência: semanal 1x / 2x / mensal / quinzenal / não repetir", () => {
    expect(montarContrato({ ...base, recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Semanal (1x por semana)");
    expect(montarContrato({ ...base, recorrencia: { freq: "semanal", vezesPorSemana: 2, repete: true } })).toContain("ocorre com a frequência Semanal (2x por semana)");
    expect(montarContrato({ ...base, recorrencia: { freq: "mensal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Mensal");
    expect(montarContrato({ ...base, recorrencia: { freq: "quinzenal", vezesPorSemana: 1, repete: true } })).toContain("ocorre com a frequência Quinzenal");
    expect(montarContrato({ ...base, recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: false } })).toContain("ocorre com a frequência Semanal.");
  });
  it("3.1 sem agendamento mantém o placeholder de frequência", () => {
    expect(montarContrato({ ...base, recorrencia: null })).toContain("[ex: 1 ou 2] vez(es) por semana");
  });
  it("3.2 horário fixo vem do último agendamento (dia da semana + hora)", () => {
    // 06/10/2026 é terça-feira, 15h00.
    expect(montarContrato(base)).toContain("Toda terça-feira, às 15h00");
  });
  it("3.2 sem agendamento mantém o placeholder", () => {
    expect(montarContrato({ ...base, horarioFixo: null })).toContain("[ex: Toda terça-feira, às 15h00]");
  });

  // Doc 26 — vencimento por formato (4.2).
  it("4.2 mensal: até o dia X do mês vigente", () => {
    expect(montarContrato({ ...base, formatoPagamento: "mensal", diaPagamento: 10 })).toContain("efetuado até o dia 10 do mês vigente");
  });
  it("4.2 quinzenal: nos dias X e X", () => {
    expect(montarContrato({ ...base, formatoPagamento: "quinzenal", diaPagamento: 10, diaPagamento2: 20 })).toContain("nos dias 10 e 20 do mês vigente");
  });
  it("4.2 primeira/última sessão do pacote", () => {
    expect(montarContrato({ ...base, formatoPagamento: "primeira_pacote" })).toContain("até a data da primeira sessão do pacote do mês vigente");
    expect(montarContrato({ ...base, formatoPagamento: "ultima_pacote" })).toContain("até a data da última sessão do pacote do mês vigente");
  });
  it("4.2 avulso: X horas antes do atendimento", () => {
    expect(montarContrato({ ...base, formatoPagamento: "sessao", horasAntesPagamento: 24 })).toContain("efetuado até 24 horas antes do atendimento");
  });
  it("4.2 gratuito: a linha vira 'Isento'", () => {
    const t = montarContrato({ ...base, formatoPagamento: "gratuito" });
    expect(t).toContain("4.2. Vencimento e Forma de Pagamento: Isento");
    expect(t).not.toContain("chave: [Sua Chave PIX]");
  });
});
