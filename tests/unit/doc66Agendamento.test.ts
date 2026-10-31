import { describe, it, expect } from "vitest";
import { blocoDoAgendamento, camposDaEscolha, escolhaEfetiva } from "@/lib/opcoesDoAgendamento";
import { pagadorSugerido, cpfCadastradoDe } from "@/lib/pagadorSugerido";
import { podeSerCortesia } from "@/lib/cortesia";

const rotulos = (o: Parameters<typeof blocoDoAgendamento>[0]) => blocoDoAgendamento(o)?.opcoes.map((x) => x.rotulo) ?? null;

describe("doc 66 — o bloco do Novo atendimento", () => {
  it("no avulso oferece Sessão Avulsa e Sessão Cortesia, desde o primeiro agendamento", () => {
    expect(rotulos({ formato: "sessao", jaTemSequencia: false })).toEqual(["Sessão Avulsa", "Sessão Cortesia"]);
    expect(rotulos({ formato: "sessao", jaTemSequencia: true })).toEqual(["Sessão Avulsa", "Sessão Cortesia"]);
  });

  it("no pacote, o PRIMEIRO agendamento oferece iniciar a sequência ou cortesia", () => {
    for (const formato of ["mensal", "quinzenal"]) {
      expect(rotulos({ formato, jaTemSequencia: false })).toEqual(["Iniciar à sequência do pacote", "Sessão Cortesia"]);
    }
  });

  it("no pacote, os DEMAIS agendamentos mantêm adicionar/não adicionar e ganham a cortesia", () => {
    expect(rotulos({ formato: "mensal", jaTemSequencia: true })).toEqual([
      "Adicionar à sequência do pacote",
      "Não adicionar à sequência do pacote",
      "Sessão Cortesia",
    ]);
  });

  it("a primeira opção é sempre a que já vem marcada", () => {
    for (const ctx of [
      { formato: "sessao", jaTemSequencia: false },
      { formato: "mensal", jaTemSequencia: false },
      { formato: "quinzenal", jaTemSequencia: true },
    ]) {
      const bloco = blocoDoAgendamento(ctx)!;
      expect(bloco.padrao).toBe(bloco.opcoes[0].valor);
      expect(bloco.padrao).toBe("normal");
    }
  });

  it("a devolutiva fica de fora: ela já tem as perguntas dela", () => {
    expect(blocoDoAgendamento({ formato: "mensal", sessionKind: "devolutiva", jaTemSequencia: true })).toBeNull();
    expect(podeSerCortesia({ sessionKind: "devolutiva" })).toBe(false);
  });

  it("o financeiro que não cobra fica de fora: cortesia ali não diria nada", () => {
    expect(blocoDoAgendamento({ formato: "gratuito", jaTemSequencia: true })).toBeNull();
  });

  it("a SÉRIE não oferece cortesia: ela é de um atendimento, não de um bloco de meses", () => {
    expect(rotulos({ formato: "sessao", emSerie: true, jaTemSequencia: true })).toBeNull();
    expect(rotulos({ formato: "mensal", emSerie: true, jaTemSequencia: false })).toBeNull();
    // Na série de quem já tem sequência, a escolha de entrar ou não entrar continua (doc 9).
    expect(rotulos({ formato: "mensal", emSerie: true, jaTemSequencia: true })).toEqual([
      "Adicionar à sequência do pacote",
      "Não adicionar à sequência do pacote",
    ]);
  });

  it("trocar para série depois de marcar cortesia volta ao padrão — não nasce série de cortesias", () => {
    const serie = blocoDoAgendamento({ formato: "mensal", jaTemSequencia: true, emSerie: true });
    expect(escolhaEfetiva(serie, "cortesia")).toBe("normal");
    expect(escolhaEfetiva(serie, "fora")).toBe("fora");
    expect(escolhaEfetiva(null, "cortesia")).toBe("normal");
    const avulso = blocoDoAgendamento({ formato: "sessao", jaTemSequencia: true });
    expect(escolhaEfetiva(avulso, "cortesia")).toBe("cortesia");
    // "fora" não existe no avulso: não há sequência da qual sair.
    expect(escolhaEfetiva(avulso, "fora")).toBe("normal");
  });

  it("a cortesia NÃO sai do pacote — quem sai é 'não adicionar à sequência'", () => {
    expect(camposDaEscolha("cortesia")).toEqual({ naSequencia: "sim", cortesia: true });
    expect(camposDaEscolha("fora")).toEqual({ naSequencia: "nao", cortesia: false });
    expect(camposDaEscolha("normal")).toEqual({ naSequencia: "sim", cortesia: false });
  });
});

describe("doc 66 — quem o Lançar pagamento já traz preenchido", () => {
  const giulia = {
    pacienteNome: "Giulia Pereira Silva de Araujo",
    pacienteCpf: "111.111.111-11",
    responsavelNome: "Elaine",
    responsavelCpf: null,
  };

  it("o defeito medido: nome do responsável NUNCA sai com o CPF do paciente", () => {
    expect(pagadorSugerido(giulia)).toEqual({ nome: "Elaine", cpf: "" });
  });

  it("havendo responsável com CPF cadastrado, usa o dele", () => {
    expect(pagadorSugerido({ ...giulia, responsavelCpf: "222.222.222-22" })).toEqual({ nome: "Elaine", cpf: "222.222.222-22" });
  });

  it("sem responsável cadastrado, vale o paciente — com o CPF dele", () => {
    expect(pagadorSugerido({ ...giulia, responsavelNome: null })).toEqual({
      nome: "Giulia Pereira Silva de Araujo",
      cpf: "111.111.111-11",
    });
  });

  it("responsável em branco é o mesmo que não ter responsável", () => {
    expect(pagadorSugerido({ ...giulia, responsavelNome: "   " }).nome).toBe("Giulia Pereira Silva de Araujo");
  });

  it("o último pagador continua sendo lembrado (17/09)", () => {
    expect(pagadorSugerido(giulia, { nome: "Avó Marta", cpf: "333.333.333-33" })).toEqual({
      nome: "Avó Marta",
      cpf: "333.333.333-33",
    });
  });

  it("último pagamento sem CPF: busca o CPF DAQUELA pessoa no cadastro, não o de qualquer um", () => {
    expect(pagadorSugerido(giulia, { nome: "Elaine", cpf: null })).toEqual({ nome: "Elaine", cpf: "" });
    expect(pagadorSugerido(giulia, { nome: "Giulia Pereira Silva de Araujo", cpf: "" })).toEqual({
      nome: "Giulia Pereira Silva de Araujo",
      cpf: "111.111.111-11",
    });
    expect(pagadorSugerido(giulia, { nome: "Avó Marta", cpf: null })).toEqual({ nome: "Avó Marta", cpf: "" });
  });

  it("a busca do CPF por nome ignora caixa e espaço nas pontas", () => {
    expect(cpfCadastradoDe("  elaine ", { ...giulia, responsavelCpf: "222.222.222-22" })).toBe("222.222.222-22");
    expect(cpfCadastradoDe("quem não está no cadastro", giulia)).toBe("");
  });
});
