import { describe, it, expect } from "vitest";
import { montarContrato, montarContratoSupervisao, textoLimpo } from "@/lib/contrato";

const c = (x: Parameters<typeof montarContrato>[0]) => textoLimpo(montarContrato(x));
const cs = (x: Parameters<typeof montarContratoSupervisao>[0]) => textoLimpo(montarContratoSupervisao(x));

/** Um adulto com a guia Dados inteira preenchida — o caso que a dona disse não estar saindo. */
const base = {
  analistaNome: "Gisele Barbosa", analistaCpf: "123.456.789-00", descricaoAtendimento: "psicanalise",
  analistaConselho: null, analistaEndereco: null, analistaPlataforma: null, analistaTelefone: null,
  analistaEmail: null, cidade: null, estado: null,
  pacienteNome: "Ana Cardoso", pacienteNascimento: new Date(2003, 5, 27), pacienteCpf: "995.637.340-69",
  pacienteEndereco: "Rua Barbosa, 164 — São Paulo/SP", pacienteTelefone: "(11) 94974-6672",
  pacienteEmail: "ana@exemplo.com",
  responsavelNome: null, responsavelCpf: null, responsavelTelefone: null, responsavelEmail: null,
  valorSessao: 120, reajusteMeses: 6, duracaoMaxMin: 50,
  recorrencia: { freq: "semanal", vezesPorSemana: 1, repete: true },
  horarioFixo: null, formatoPagamento: "mensal", diaPagamento: 5, diaPagamento2: null,
  horasAntesPagamento: null, hoje: new Date(2026, 9, 28),
};

describe("doc 65 — a identificação do PACIENTE no contrato", () => {
  it("CPF, endereço, telefone e e-mail do paciente aparecem no bloco dele", () => {
    const t = c(base);
    const bloco = t.slice(t.indexOf("PACIENTE:"), t.indexOf("2. DO OBJETO"));
    expect(bloco).toContain("Nome: Ana Cardoso");
    expect(bloco).toContain("CPF: 995.637.340-69");
    expect(bloco).toContain("Endereço: Rua Barbosa, 164 — São Paulo/SP");
    expect(bloco).toContain("Telefone: (11) 94974-6672");
    expect(bloco).toContain("E-mail: ana@exemplo.com");
  });

  it("campo não preenchido continua saindo do contrato — a regra do doc 41 não muda", () => {
    const t = c({ ...base, pacienteCpf: null, pacienteEmail: null });
    const bloco = t.slice(t.indexOf("PACIENTE:"), t.indexOf("2. DO OBJETO"));
    expect(bloco).not.toContain("CPF:");
    expect(bloco).not.toContain("E-mail:");
    expect(bloco).toContain("Telefone: (11) 94974-6672");
  });
});

describe("doc 65 — sem responsável, quem contrata é o próprio paciente", () => {
  /**
   * O caso real: cadastro sem data de nascimento e sem responsável. A idade desconhecida caía no
   * caminho do menor de idade, o contrato ia buscar um responsável que não existe, e o bloco
   * CONTRATANTE saía vazio — junto com a linha da assinatura.
   */
  const semNascimento = { ...base, pacienteNascimento: null };

  it("sem data de nascimento e sem responsável, o contratante é o paciente", () => {
    const t = c(semNascimento);
    // Doc 70: o cabeçalho passou a ser "CONTRATANTE/ PACIENTE:" quando são a mesma pessoa.
    const bloco = t.slice(t.indexOf("CONTRATANTE/ PACIENTE:"), t.indexOf("2. DO OBJETO"));
    expect(bloco).toContain("Nome: Ana Cardoso");
    expect(bloco).toContain("CPF: 995.637.340-69");
    expect(bloco).toContain("Telefone: (11) 94974-6672");
    expect(bloco).toContain("E-mail: ana@exemplo.com");
  });

  it("e o nome aparece na linha da assinatura, no lugar do placeholder", () => {
    const t = c(semNascimento);
    expect(t).toContain("Ana Cardoso — Contratante / Responsável Legal");
    expect(t).not.toContain("[NOME DO RESPONSÁVEL 1]");
  });

  it("com responsável cadastrado, nada muda: ele continua sendo o contratante", () => {
    const t = c({ ...semNascimento, responsavelNome: "Roberta Cruz", responsavelCpf: "111.222.333-44" });
    expect(t).toContain("Nome do Responsável: Roberta Cruz");
    expect(t).toContain("Roberta Cruz — Contratante / Responsável Legal");
  });

  it("menor de idade com responsável: o responsável assina sozinho, como antes", () => {
    const t = c({ ...base, pacienteNascimento: new Date(2015, 0, 1), responsavelNome: "Roberta Cruz", responsavelCpf: "111.222.333-44" });
    expect(t).toContain("Nome do Responsável: Roberta Cruz");
    expect(t).not.toContain("Nome do Responsável 2");
  });

  it("maior de idade com responsável: o paciente assina como Contratante 2, como antes", () => {
    const t = c({ ...base, responsavelNome: "Roberta Cruz", responsavelCpf: "111.222.333-44" });
    expect(t).toContain("Nome do Responsável: Roberta Cruz");
    expect(t).toContain("Nome do Responsável 2: Ana Cardoso");
  });
});

describe("doc 65 — a cláusula 5.4 (falta do profissional)", () => {
  it("oferece reposição e, não havendo, converte o valor já pago em crédito", () => {
    const t = c(base);
    expect(t).toContain("5.4. Faltas do Profissional: Caso o PROFISSIONAL precise cancelar uma sessão por motivo de força maior, deverá oferecer ao paciente a possibilidade de reposição do atendimento, em data e horário acordados entre ambas as partes. Caso a reposição não seja possível, a sessão não será cobrada ou, se já tiver sido paga, o valor correspondente será convertido em crédito para o próximo atendimento.");
    expect(t).not.toContain("será obrigatoriamente reposta");
  });

  it("no contrato de supervisão, a outra parte é o SUPERVISIONANDO", () => {
    const t = cs(base);
    expect(t).toContain("deverá oferecer ao SUPERVISIONANDO a possibilidade de reposição do atendimento");
    expect(t).not.toContain("será obrigatoriamente reposta");
  });
});

describe("doc 65 — o contrato de SUPERVISÃO", () => {
  it("sem responsável, o contratante é o próprio supervisionando, com e-mail", () => {
    const t = cs(base);
    const bloco = t.slice(t.indexOf("CONTRATANTE(S):"), t.indexOf("SUPERVISIONANDO(A):"));
    expect(bloco).toContain("Nome: Ana Cardoso");
    expect(bloco).toContain("E-mail: ana@exemplo.com");
    expect(t).toContain("Ana Cardoso — Contratante / Responsável Legal");
  });

  it("o bloco do supervisionando também identifica CPF, endereço, telefone e e-mail", () => {
    const t = cs(base);
    const bloco = t.slice(t.indexOf("SUPERVISIONANDO(A):"), t.indexOf("2. DO OBJETO"));
    expect(bloco).toContain("CPF: 995.637.340-69");
    expect(bloco).toContain("Endereço: Rua Barbosa, 164 — São Paulo/SP");
    expect(bloco).toContain("Telefone: (11) 94974-6672");
    expect(bloco).toContain("E-mail: ana@exemplo.com");
  });
});
