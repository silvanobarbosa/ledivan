import { describe, it, expect } from "vitest";
import {
  mensagemDoLembrete,
  posicaoNoPacote,
  quandoDoDisparo,
  dataDoLembrete,
  horaDoLembrete,
  DIAS_A_FRENTE,
  HORA_DO_LEMBRETE,
} from "@/lib/lembreteDaSessao";

/**
 * Doc 61: os quatro textos do lembrete são pedido LITERAL do dono, com as linhas em branco.
 * Conferir a mensagem inteira — e não um pedaço — é o que faz uma reescrita reprovar.
 */
describe("doc 61: o texto do lembrete de sessão", () => {
  const sessao = "2026-11-09T16:30:00";

  it("no dia, pacote: diz a posição dentro do pacote", () => {
    expect(mensagemDoLembrete({ nome: "Joyce Ribeiro", quando: sessao, vespera: false, pacote: { posicao: 3, total: 4 } })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para lembrar que hoje, 09/11/26, você tem terapia às 16h30.",
        "",
        "Sessão 3 de 4 do pacote.",
        "",
        "Aguardo você! 😊",
      ].join("\n"),
    );
  });

  it("no dia, avulsa ou gratuita: sem contagem, e 'sessão de terapia'", () => {
    expect(mensagemDoLembrete({ nome: "Joyce Ribeiro", quando: sessao, vespera: false })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para lembrar que hoje 09/11/26, você tem sessão de terapia às 16h30.",
        "",
        "Aguardo você! 😊",
      ].join("\n"),
    );
  });

  it("na véspera, pacote: 'amanhã'", () => {
    expect(mensagemDoLembrete({ nome: "Joyce", quando: sessao, vespera: true, pacote: { posicao: 1, total: 8 } })).toContain(
      "Passando para lembrar que amanhã, 09/11/26, você tem terapia às 16h30.",
    );
  });

  it("na véspera, avulsa: 'amanhã' e sem contagem", () => {
    const m = mensagemDoLembrete({ nome: "Joyce", quando: sessao, vespera: true });
    expect(m).toContain("Passando para lembrar que amanhã 09/11/26, você tem sessão de terapia às 16h30.");
    expect(m).not.toContain("do pacote");
  });

  it("sem nome, o 'Olá!' não fica com espaço solto", () => {
    expect(mensagemDoLembrete({ nome: null, quando: sessao, vespera: false })).toContain("Olá!");
  });

  it("a data e a hora saem da hora de PAREDE, sem passar por fuso", () => {
    expect(dataDoLembrete("2026-01-02T09:05:00")).toBe("02/01/26");
    expect(horaDoLembrete("2026-01-02T09:05:00")).toBe("09h05");
    expect(horaDoLembrete(new Date(2026, 0, 2, 9, 5))).toBe("09h05");
  });
});

/**
 * Os dois disparos nunca servem o mesmo terapeuta — é isso que impede o paciente de receber dois
 * lembretes da mesma sessão. A hora exata não entra na conta: a Vercel não garante o minuto.
 */
describe("doc 61: quando cada disparo acontece", () => {
  it("o turno da manhã é o de quem escolheu 'no dia'; o da tarde, o da véspera", () => {
    expect(quandoDoDisparo(6)).toBe("dia");
    expect(quandoDoDisparo(11)).toBe("dia");
    expect(quandoDoDisparo(15)).toBe("vespera");
    expect(quandoDoDisparo(23)).toBe("vespera");
  });

  it("cada escolha olha para um dia diferente da agenda", () => {
    expect(DIAS_A_FRENTE.dia).toBe(0);
    expect(DIAS_A_FRENTE.vespera).toBe(1);
    expect(HORA_DO_LEMBRETE.dia).toBe(6);
    expect(HORA_DO_LEMBRETE.vespera).toBe(15);
  });
});

describe("a posição da sessão no pacote", () => {
  const cobrancas = [
    { tipoDeCobranca: "sessao", ids: ["avulsa"], sessoes: 1 },
    { tipoDeCobranca: "pacote", ids: ["a", "b", "c", "d"], sessoes: 4 },
    { tipoDeCobranca: "quinzena", ids: ["e", "f"], sessoes: 2 },
  ];

  it("acha a sessão no pacote que a cobre", () => {
    expect(posicaoNoPacote(cobrancas, "c")).toEqual({ posicao: 3, total: 4 });
    expect(posicaoNoPacote(cobrancas, "f")).toEqual({ posicao: 2, total: 2 });
  });

  it("sessão avulsa não tem posição — e inventar uma seria dizer algo falso", () => {
    expect(posicaoNoPacote(cobrancas, "avulsa")).toBeNull();
    expect(posicaoNoPacote(cobrancas, "nao-existe")).toBeNull();
  });

  it("pacote com sessão a mais no grupo conta o grupo inteiro, não o tamanho contratado", () => {
    expect(posicaoNoPacote([{ tipoDeCobranca: "pacote", ids: ["a", "b", "c", "d", "e"], sessoes: 4 }], "e"))
      .toEqual({ posicao: 5, total: 5 });
  });
});
