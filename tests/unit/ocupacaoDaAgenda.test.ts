import { describe, expect, it } from "vitest";
import { ehQuinzenal, espelhosDoDia, sinaisDaSessao } from "@/lib/ocupacaoDaAgenda";

/**
 * O ESPELHO DO QUINZENAL e os sinais da célula.
 *
 * O espelho existia mas **nunca aparecia**: ele dependia de a SESSÃO guardar a frequência, e a
 * base tem 43 pacientes quinzenais cujas sessões não guardam. Zero espelhos em toda a agenda.
 * Marca que nunca aparece é marca que não existe.
 */

const qua = (dia: number, hora = 8) => new Date(2026, 8, dia, hora, 0, 0);

const sessao = (id: string, dia: number, hora = 8, pacienteId = "p1") => ({
  id,
  data: qua(dia, hora),
  duracao: 50,
  pacienteId,
});

describe("quem é quinzenal", () => {
  it("pelo formato de pagamento", () => {
    expect(ehQuinzenal({ id: "p1", formato: "quinzenal" })).toBe(true);
  });

  it("pela frequência escrita no cadastro, que é onde a base guarda", () => {
    expect(ehQuinzenal({ id: "p1", frequencia: "Quinzenal" })).toBe(true);
    expect(ehQuinzenal({ id: "p1", frequencia: "quinzenal (2x/mês)" })).toBe(true);
  });

  it("quem não é, não é", () => {
    expect(ehQuinzenal({ id: "p1", formato: "mensal", frequencia: "semanal" })).toBe(false);
    expect(ehQuinzenal(null)).toBe(false);
    expect(ehQuinzenal({ id: "p1" })).toBe(false);
  });
});

describe("o espelho da semana alternada", () => {
  const sempreQuinzenal = () => true;

  it("aparece a sete dias de uma sessão quinzenal", () => {
    // Sessões em 09 e 23; a semana de 16 é a alternada.
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("a", 9), sessao("b", 23)],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toHaveLength(1);
    expect(e[0].hora).toBe(8);
    expect(e[0].pacienteId).toBe("p1");
  });

  it("APARECE mesmo quando a sessão não guarda a frequência — é o caso da base inteira", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("a", 9)],
      quinzenal: (id) => id === "p1",
    });
    expect(e).toHaveLength(1);
  });

  it("a sessão que sabe da própria frequência dispensa o cadastro", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [{ ...sessao("a", 9), recorrenciaQuinzenal: true }],
      quinzenal: () => false,
    });
    expect(e).toHaveLength(1);
  });

  it("paciente que NÃO é quinzenal não gera espelho", () => {
    const e = espelhosDoDia({ dia: qua(16), sessoes: [sessao("a", 9)], quinzenal: () => false });
    expect(e).toEqual([]);
  });

  it("horário já encaixado deixa de ser espelho", () => {
    // Alguém marcou no 16 às 8h: o lugar está ocupado, não é mais espelho.
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("a", 9), sessao("encaixe", 16, 8, "p2")],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toEqual([]);
  });

  it("semana seguinte de um SEMANAL não vira espelho", () => {
    // A sete dias existe sessão, mas quem não é quinzenal ocupa todas as semanas.
    const e = espelhosDoDia({ dia: qua(16), sessoes: [sessao("a", 9)], quinzenal: () => false });
    expect(e).toEqual([]);
  });

  it("catorze dias de distância não é a semana alternada", () => {
    const e = espelhosDoDia({ dia: qua(23), sessoes: [sessao("a", 9)], quinzenal: sempreQuinzenal });
    expect(e).toEqual([]);
  });

  it("dois quinzenais em horários diferentes geram dois espelhos, em ordem", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("a", 9, 14, "p1"), sessao("b", 9, 8, "p2")],
      quinzenal: sempreQuinzenal,
    });
    expect(e.map((x) => x.hora)).toEqual([8, 14]);
  });

  it("o mesmo paciente não gera espelho duplicado", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("a", 9), sessao("b", 23)],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toHaveLength(1);
  });

  it("data inválida não derruba o cálculo", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [{ id: "x", data: "nada", duracao: 50, pacienteId: "p1" }, sessao("a", 9)],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toHaveLength(1);
  });

  // Doc 36: sessão editada "APENAS ESTE" (soEspelhoAnterior) só espelha a semana ANTERIOR a ela.
  it("sessão 'apenas este' ESPELHA a semana anterior a ela", () => {
    // Sessão no dia 9; a semana anterior é o dia 2.
    const e = espelhosDoDia({
      dia: qua(2),
      sessoes: [{ ...sessao("a", 9), soEspelhoAnterior: true }],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toHaveLength(1);
  });

  it("sessão 'apenas este' NÃO espelha a semana posterior a ela", () => {
    // Sessão no dia 9; a semana posterior é o dia 16 — não deve aparecer.
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [{ ...sessao("a", 9), soEspelhoAnterior: true }],
      quinzenal: sempreQuinzenal,
    });
    expect(e).toHaveLength(0);
  });

  it("sem o flag, segue espelhando os dois lados (controle)", () => {
    const anterior = espelhosDoDia({ dia: qua(2), sessoes: [sessao("a", 9)], quinzenal: sempreQuinzenal });
    const posterior = espelhosDoDia({ dia: qua(16), sessoes: [sessao("a", 9)], quinzenal: sempreQuinzenal });
    expect(anterior).toHaveLength(1);
    expect(posterior).toHaveLength(1);
  });
});

describe("os sinais da célula", () => {
  it("cada fato acende um sinal", () => {
    const s = sinaisDaSessao({ online: true, pediuRemarcacao: true });
    expect(s.map((x) => x.chave)).toEqual(["remarcar", "online"]);
  });

  it("o que muda a conduta de hoje vem primeiro", () => {
    // Quem pediu para remarcar importa mais do que o contexto (online).
    const s = sinaisDaSessao({ pediuRemarcacao: true, online: true });
    expect(s[0].chave).toBe("remarcar");
  });

  it("sessão sem nada não acende sinal nenhum", () => {
    expect(sinaisDaSessao({})).toEqual([]);
  });

  it("todo sinal tem um título em palavras", () => {
    const s = sinaisDaSessao({
      reservaVencida: true, pediuRemarcacao: true, realocada: true, pedidoDoPaciente: true,
      pacienteConfirmou: true, online: true,
    });
    expect(s).toHaveLength(6);
    for (const x of s) expect(x.titulo.length, x.chave).toBeGreaterThan(10);
  });

  it("chegou, pagamento atrasado e histórico de faltas não acendem mais (dono, 16/09)", () => {
    const s = sinaisDaSessao({ chegou: true, pagamentoAtrasado: true, riscoDeFalta: "alto" } as never);
    expect(s).toEqual([]);
  });

  it("reserva vencida acende o sinal 'pendente', antes de tudo", () => {
    const s = sinaisDaSessao({ reservaVencida: true, online: true });
    expect(s[0].chave).toBe("pendente");
    expect(s[0].titulo.length).toBeGreaterThan(10);
  });
});

/**
 * DE QUAL SESSÃO O ESPELHO SAI (doc 57).
 *
 * Importa porque é nela que a exclusão pega. O slot vazio não existe no banco: quem clica nele
 * e manda excluir está mandando apagar a SÉRIE quinzenal daquele paciente, daqui para a frente.
 * Por isso o alvo tem de ser a PRIMEIRA sessão que ainda está por vir — a de sete dias à frente
 * nem sempre é essa, e começar tarde demais deixaria viva justamente a próxima.
 */
describe("a sessão que projeta o espelho", () => {
  const sempreQuinzenal = () => true;

  /**
   * Doc 60: "este e os próximos" conta a partir do SLOT, não de hoje.
   *
   * Com as duas vizinhas ainda por vir, o alvo é a de DEPOIS. Mirar na de antes — que era o que
   * acontecia — fazia um clique num slot de dezembro apagar a série desde novembro: a terapeuta
   * via sumir agendamento anterior ao que ela clicou, sem nada na tela avisando.
   */
  it("com as duas ainda por vir, o alvo é a de DEPOIS — o passado do slot não se mexe", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("antes", 9), sessao("depois", 23)],
      quinzenal: sempreQuinzenal,
      hoje: qua(1),
    });
    expect(e).toHaveLength(1);
    expect(e[0].sessaoId).toBe("depois");
    expect(e[0].sessaoFutura).toBe(true);
  });

  it("o alvo nunca é sessão passada, mesmo que ela caia depois do slot", () => {
    // Slot no passado (a semana de trás continua desenhada), com a série viva à frente.
    const e = espelhosDoDia({
      dia: qua(2),
      sessoes: [sessao("ja-aconteceu", 9), sessao("por-vir", 23)],
      quinzenal: sempreQuinzenal,
      hoje: qua(16),
    });
    expect(e[0].sessaoId).toBe("por-vir");
  });

  it("com a primeira já no passado, o alvo é a de depois", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("antes", 9), sessao("depois", 23)],
      quinzenal: sempreQuinzenal,
      hoje: qua(20),
    });
    expect(e[0].sessaoId).toBe("depois");
    expect(e[0].sessaoFutura).toBe(true);
  });

  it("a ordem em que as sessões chegam não muda a escolha", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("depois", 23), sessao("bem-depois", 30), sessao("antes", 9)],
      quinzenal: sempreQuinzenal,
      hoje: qua(1),
    });
    expect(e[0].sessaoId).toBe("depois");
  });

  it("só com sessão passada, o espelho existe mas se declara NÃO futuro", () => {
    // A tela usa isso para não oferecer a exclusão: não há o que apagar daqui para a frente.
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("antes", 9)],
      quinzenal: sempreQuinzenal,
      hoje: qua(20),
    });
    expect(e).toHaveLength(1);
    expect(e[0].sessaoId).toBe("antes");
    expect(e[0].sessaoFutura).toBe(false);
  });

  it("cada paciente traz a sua própria sessão", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("da-p1", 23, 8, "p1"), sessao("da-p2", 23, 14, "p2")],
      quinzenal: sempreQuinzenal,
      hoje: qua(1),
    });
    expect(e.map((x) => x.sessaoId)).toEqual(["da-p1", "da-p2"]);
  });
});

/**
 * O REFLEXO DE UMA COMBINAÇÃO QUE ACABOU (docs 58 e 59).
 *
 * Foi o que a terapeuta viu duas vezes: excluiu a série, os próximos sumiram, e o slot que ela
 * tinha clicado continuou lá — projetado por uma sessão que já aconteceu e que ninguém pode
 * apagar. Na segunda vez ela abriu a janela e nem botão de excluir havia mais.
 */
describe("o reflexo de uma combinação que acabou", () => {
  const sempreQuinzenal = () => true;

  it("não sobrevive a um dia que ainda está por vir: sem nada à frente, o slot nem é desenhado", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("ja-aconteceu", 9)],
      quinzenal: sempreQuinzenal,
      hoje: qua(10),
    });
    expect(e).toHaveLength(0);
  });

  it("em dia PASSADO o reflexo fica: ali ele é história, e a semana de trás tem de parecer o que foi", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("ja-aconteceu", 9)],
      quinzenal: sempreQuinzenal,
      hoje: qua(20),
    });
    expect(e).toHaveLength(1);
    expect(e[0].sessaoFutura).toBe(false);
  });

  it("com a série viva mais adiante, o alvo é a próxima que sobrou — mesmo longe do slot", () => {
    // A vizinha de frente foi excluída; a de trás já aconteceu. O botão tem de continuar existindo,
    // apontando para a próxima sessão daquele mesmo dia e horário.
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("ja-aconteceu", 9), sessao("mais-adiante", 30)],
      quinzenal: sempreQuinzenal,
      hoje: qua(10),
    });
    expect(e).toHaveLength(1);
    expect(e[0].sessaoId).toBe("mais-adiante");
    expect(e[0].sessaoFutura).toBe(true);
  });

  it("um encaixe em OUTRO dia da semana não serve de alvo — não é a mesma combinação", () => {
    const encaixe = { id: "sexta", data: new Date(2026, 8, 25, 8, 0, 0), duracao: 50, pacienteId: "p1" };
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("ja-aconteceu", 9), encaixe],
      quinzenal: sempreQuinzenal,
      hoje: qua(10),
    });
    expect(e).toHaveLength(0);
  });

  it("a sessão de OUTRO paciente no mesmo horário não mantém o reflexo vivo", () => {
    const e = espelhosDoDia({
      dia: qua(16),
      sessoes: [sessao("ja-aconteceu", 9), sessao("de-outro", 30, 8, "p2")],
      quinzenal: sempreQuinzenal,
      hoje: qua(10),
    });
    expect(e.filter((x) => x.pacienteId === "p1")).toHaveLength(0);
  });
});
