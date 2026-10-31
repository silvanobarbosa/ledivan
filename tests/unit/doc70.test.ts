import { describe, it, expect } from "vitest";
import { nomeCompletoDoCadastro, pagadorSugerido } from "@/lib/pagadorSugerido";
import { devolutivaParaGravar } from "@/lib/quadroDaDevolutiva";
import { pacientesComSequencia } from "@/lib/sessaoExtra";
import { montarContrato, textoLimpo } from "@/lib/contrato";

describe("doc 70 — o nome do pagador sai completo", () => {
  const cadastro = { pacienteNome: "Renata Magalhães Nascimento Silabi", pacienteCpf: "", responsavelNome: null, responsavelCpf: null };

  it("o primeiro nome vira o nome do cadastro", () => {
    expect(nomeCompletoDoCadastro("Renata", cadastro)).toBe("Renata Magalhães Nascimento Silabi");
  });

  it("e a memória do último pagamento também sai completa", () => {
    expect(pagadorSugerido(cadastro, { nome: "Renata", cpf: null }).nome).toBe("Renata Magalhães Nascimento Silabi");
  });

  it("cadastro que SÓ tem o primeiro nome fica como está — não se inventa sobrenome", () => {
    // Medido na base: dos 12 pagadores de uma palavra só, dez são assim. O responsável chama-se
    // "Gabriela" no cadastro, e não há nome completo a buscar em lugar nenhum.
    const c = { pacienteNome: "Catarina Aguiar Serra", responsavelNome: "Gabriela" };
    expect(nomeCompletoDoCadastro("Gabriela", c)).toBe("Gabriela");
  });

  it("mãe e filha com o mesmo primeiro nome: não dá para saber qual, então não completa", () => {
    const c = { pacienteNome: "Ana Souza Lima", responsavelNome: "Ana Souza" };
    expect(nomeCompletoDoCadastro("Ana", c)).toBe("Ana");
  });

  it("quem já veio completo não é mexido, e o nome de quem não é do cadastro também não", () => {
    expect(nomeCompletoDoCadastro("Renata Magalhães Nascimento Silabi", cadastro)).toBe("Renata Magalhães Nascimento Silabi");
    expect(nomeCompletoDoCadastro("Joaquina", cadastro)).toBe("Joaquina");
    expect(nomeCompletoDoCadastro("", cadastro)).toBe("");
  });
});

describe("doc 70 — devolutiva de paciente GRATUITO não pergunta da sequência", () => {
  it("não cobrada e sem sequência: grava sem exigir a segunda resposta", () => {
    const r = devolutivaParaGravar({ escolha: "nao_cobrar", semSequencia: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.abaterDoPacote).toBe(false);
  });

  it("nos demais formatos a pergunta continua obrigatória", () => {
    const r = devolutivaParaGravar({ escolha: "nao_cobrar" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/abate da sequência/i);
  });

  it("cobrada segue igual, com ou sem sequência", () => {
    const r = devolutivaParaGravar({ escolha: "cobrar", valor: "R$ 120,00", semSequencia: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valorExtra).toBe("120.00");
  });
});

describe("doc 70 — o que foi atendido no GRATUITO não começa sequência", () => {
  const SESSOES = [
    { patientId: "p1", date: new Date(2026, 0, 10) }, // enquanto era gratuito
    { patientId: "p1", date: new Date(2026, 5, 10) }, // já mensal
    { patientId: "p2", date: new Date(2026, 0, 10) }, // gratuito, e só
  ];
  // Virou mensal em 01/03/2026 (p1); p2 nunca saiu do gratuito.
  const usaPacoteNaData = (id: string, d: Date) => id === "p1" && d >= new Date(2026, 2, 1);

  it("sem a pergunta do formato, qualquer sessão conta — o comportamento antigo", () => {
    expect(pacientesComSequencia(SESSOES)).toEqual(new Set(["p1", "p2"]));
  });

  it("com ela, só conta quem foi atendido num período que usa pacote", () => {
    expect(pacientesComSequencia(SESSOES, usaPacoteNaData)).toEqual(new Set(["p1"]));
  });

  it("quem só tem sessão do tempo de gratuito ainda vai INICIAR a sequência", () => {
    const soGratuito = [{ patientId: "p1", date: new Date(2026, 0, 10) }];
    expect(pacientesComSequencia(soGratuito, usaPacoteNaData).size).toBe(0);
  });
});

describe("doc 70 — o contrato de quem contrata por si", () => {
  const base = {
    analistaNome: "Ana Terapeuta", analistaConselho: "CRP 00/0000", analistaCpf: "000.000.000-00",
    pacienteNome: "João Silva", pacienteCpf: "111.111.111-11", pacienteNascimento: new Date(1990, 0, 1),
    pacienteEndereco: "Rua A, 1", pacienteTelefone: "(11) 90000-0000", pacienteEmail: "joao@exemplo.com",
    responsavelNome: null, responsavelCpf: null,
    descricaoAtendimento: "psicanalise", formatoPagamento: "sessao", valorSessao: "200.00",
  };
  // `textoLimpo` tira os marcadores de negrito (\u0001…\u0002) do contrato impresso.
  const t = textoLimpo(montarContrato(base as never));

  it("o cabeçalho junta os dois papéis e o bloco PACIENTE não se repete", () => {
    expect(t).toContain("CONTRATANTE/ PACIENTE:");
    expect(t).not.toContain("CONTRATANTE(S):");
    expect(t).not.toContain("\nPACIENTE:");
  });

  it("a data de nascimento vem logo abaixo do nome", () => {
    expect(t).toContain("Nome: João Silva\nData de Nascimento: 01/01/1990");
  });

  it("a idade não aparece em lugar nenhum — ela envelhece depois de o papel ser assinado", () => {
    expect(t).not.toMatch(/Idade:/);
  });

  it("a cláusula 3.2 fala só do paciente", () => {
    expect(t).toContain("Atrasos por parte do paciente não implicarão");
    expect(t).not.toContain("paciente/responsáveis");
  });

  it("com responsável cadastrado, volta a ter duas áreas", () => {
    const comResp = textoLimpo(montarContrato({ ...base, responsavelNome: "Maria Silva", responsavelCpf: "222.222.222-22" } as never));
    expect(comResp).toContain("CONTRATANTE(S):");
    expect(comResp).toContain("PACIENTE:");
  });
});
