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
