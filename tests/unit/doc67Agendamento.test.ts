import { describe, it, expect } from "vitest";
import { blocoDoAgendamento, camposDaEscolha, escolhaEfetiva } from "@/lib/opcoesDoAgendamento";
import { pagadorSugerido, cpfCadastradoDe } from "@/lib/pagadorSugerido";
import { podeSerCortesia } from "@/lib/cortesia";

const rotulos = (o: Parameters<typeof blocoDoAgendamento>[0]) => blocoDoAgendamento(o)?.opcoes.map((x) => x.rotulo) ?? null;

describe("doc 67 — o quadro do Novo atendimento", () => {
  it("no PRIMEIRO agendamento o verbo é 'Iniciar': não há sequência para adicionar a", () => {
    expect(rotulos({ formato: "mensal", jaTemSequencia: false })).toEqual([
      "Iniciar à sequência do pacote",
      "Não adicionar à sequência do pacote",
    ]);
  });

  it("nos demais, 'Adicionar' — e nada mais muda", () => {
    expect(rotulos({ formato: "quinzenal", jaTemSequencia: true })).toEqual([
      "Adicionar à sequência do pacote",
      "Não adicionar à sequência do pacote",
    ]);
  });

  it("não há botão de cortesia: 'já temos a opção GRAT no não adicionar' (dono)", () => {
    for (const ctx of [
      { formato: "mensal", jaTemSequencia: false },
      { formato: "mensal", jaTemSequencia: true },
      { formato: "quinzenal", jaTemSequencia: true },
    ]) {
      expect(rotulos(ctx)?.some((r) => /cortesia/i.test(r))).toBe(false);
    }
  });

  // Doc 71 SUPERA esta regra para quem paga A CADA SESSÃO: ali passou a existir um quadro, o da
  // cortesia (ver `doc71.test.ts`). O gratuito continua sem quadro nenhum — ele já não cobra.
  it("o gratuito não tem quadro nenhum", () => {
    expect(blocoDoAgendamento({ formato: "gratuito", jaTemSequencia: true })).toBeNull();
  });

  it("a devolutiva fica de fora: ela já tem as perguntas dela", () => {
    expect(blocoDoAgendamento({ formato: "mensal", sessionKind: "devolutiva", jaTemSequencia: true })).toBeNull();
    expect(podeSerCortesia({ sessionKind: "devolutiva" })).toBe(false);
  });

  it("a primeira opção é sempre a que já vem marcada", () => {
    for (const ctx of [{ formato: "mensal", jaTemSequencia: false }, { formato: "quinzenal", jaTemSequencia: true }]) {
      const bloco = blocoDoAgendamento(ctx)!;
      expect(bloco.padrao).toBe(bloco.opcoes[0].valor);
      expect(bloco.padrao).toBe("normal");
    }
  });

  it("uma escolha que deixou de existir volta ao padrão", () => {
    const bloco = blocoDoAgendamento({ formato: "mensal", jaTemSequencia: true });
    expect(escolhaEfetiva(bloco, "fora")).toBe("fora");
    expect(escolhaEfetiva(null, "fora")).toBe("normal");
  });

  it("'fora' é o que sai do pacote, e é o que o servidor lê", () => {
    // Doc 71 acrescentou `cortesia` ao formulário; o que esta regra diz continua sendo a sequência.
    expect(camposDaEscolha("fora").naSequencia).toBe("nao");
    expect(camposDaEscolha("normal").naSequencia).toBe("sim");
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

  // Doc 72 SUPERA a memória do último pagador (17/09): "uma vez que é alterado o nome do
  // responsável do pagamento, esta alteração deve ser registrada apenas para o registro alterado".
  it("o último pagador NÃO é mais lembrado — a troca fica no lançamento dela (doc 72)", () => {
    expect(pagadorSugerido(giulia, { nome: "Avó Marta", cpf: "333.333.333-33" })).toEqual({
      nome: "Elaine",
      cpf: "",
    });
  });

  it("o CPF continua saindo do cadastro DAQUELA pessoa, nunca do outro", () => {
    expect(cpfCadastradoDe("Elaine", giulia)).toBe("");
    expect(cpfCadastradoDe("Giulia Pereira Silva de Araujo", giulia)).toBe("111.111.111-11");
  });

  it("a busca do CPF por nome ignora caixa e espaço nas pontas", () => {
    expect(cpfCadastradoDe("  elaine ", { ...giulia, responsavelCpf: "222.222.222-22" })).toBe("222.222.222-22");
    expect(cpfCadastradoDe("quem não está no cadastro", giulia)).toBe("");
  });
});
