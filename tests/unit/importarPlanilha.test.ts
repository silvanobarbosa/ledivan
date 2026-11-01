import { describe, it, expect } from "vitest";
import {
  conferir, resumo, comoData, comoHora, comoDinheiro, comoOpcao, igual,
  FORMATOS, STATUS, TETO_DE_LINHAS,
} from "@/lib/importarPlanilha";

/**
 * A planilha de importação vem DE FORA — de outro sistema, de outra pessoa, de um Excel que
 * alguém preencheu no celular. Tudo aqui é sobre não deixar isso virar base suja: a linha com
 * problema fica de fora, as outras entram, e a terapeuta vê o que vai acontecer antes de gravar.
 */

const paciente = (extra: Record<string, unknown> = {}) => ({
  nome: "Maria Souza Lima", formato_pagamento: "mensal", valor_sessao: "150,00", ...extra,
});

describe("as três formas em que uma data chega", () => {
  it("dd/mm/aaaa, que é o que se digita", () => {
    expect(comoData("05/02/2025")).toEqual(new Date(2025, 1, 5));
    expect(comoData("5/2/25")).toEqual(new Date(2025, 1, 5));
  });

  it("ISO, que é o que sai de exportação", () => {
    expect(comoData("2025-02-05")).toEqual(new Date(2025, 1, 5));
  });

  it("NÚMERO, que é o que o Excel guarda numa célula formatada como data", () => {
    // 45693 = 05/02/2025. É o caso que passa despercebido até alguém importar o ano errado.
    expect(comoData(45693)).toEqual(new Date(2025, 1, 5));
  });

  it("data impossível não vira data silenciosamente", () => {
    expect(comoData("31/02/2025")).toBeNull();
    expect(comoData("qualquer coisa")).toBeNull();
    expect(comoData("")).toBeNull();
  });
});

describe("hora e dinheiro", () => {
  it("hora em hh:mm e na fração de dia do Excel", () => {
    expect(comoHora("14:00")).toEqual({ h: 14, m: 0 });
    expect(comoHora("9:30")).toEqual({ h: 9, m: 30 });
    expect(comoHora(0.5)).toEqual({ h: 12, m: 0 });
    expect(comoHora("25:00")).toBeNull();
  });

  it("dinheiro em pt-BR, cru, e com R$", () => {
    expect(comoDinheiro("150,00")).toBe(150);
    expect(comoDinheiro("1.234,56")).toBe(1234.56);
    expect(comoDinheiro("R$ 600,00")).toBe(600);
    expect(comoDinheiro(150.5)).toBe(150.5);
    expect(comoDinheiro("abc")).toBeNull();
  });

  it("opção ignora caixa e acento — ninguém digita com acento certo sempre", () => {
    expect(comoOpcao("MENSAL", FORMATOS)).toBe("mensal");
    expect(comoOpcao("nao realizada", STATUS)).toBe("não realizada");
    expect(comoOpcao("inventada", STATUS)).toBeNull();
    expect(igual(" Maria  Souza ", "maria souza")).toBe(true);
  });
});

describe("a aba Pacientes", () => {
  it("lê uma linha completa", () => {
    const l = conferir({ Pacientes: [paciente({ nascimento: "12/03/1990", cpf: "123.456.789-00", pacote_tipo: "completo", dia_vencimento: "10", sessoes_no_pacote: "4", inicio: "05/02/2025" })] });
    expect(l.problemas).toEqual([]);
    expect(l.pacientes[0]).toMatchObject({
      nome: "Maria Souza Lima", formato: "mensal", pacoteTipo: "completo",
      valorSessao: 150, diaVencimento: 10, sessoesNoPacote: 4,
    });
    expect(l.pacientes[0].cpf).toBe("12345678900");
  });

  it("formato de pagamento inválido derruba a LINHA, não a planilha", () => {
    const l = conferir({ Pacientes: [paciente(), paciente({ nome: "Outro", formato_pagamento: "inventado" })] });
    expect(l.pacientes).toHaveLength(1);
    expect(l.problemas[0]).toMatchObject({ aba: "Pacientes", linha: 3, coluna: "formato_pagamento" });
  });

  it("quem não é gratuito precisa de valor", () => {
    const l = conferir({ Pacientes: [paciente({ valor_sessao: "" })] });
    expect(l.pacientes).toHaveLength(0);
    expect(l.problemas.some((p) => p.coluna === "valor_sessao")).toBe(true);
  });

  it("gratuito entra sem valor", () => {
    const l = conferir({ Pacientes: [paciente({ formato_pagamento: "gratuito", valor_sessao: "" })] });
    expect(l.pacientes).toHaveLength(1);
    expect(l.pacientes[0].formato).toBe("gratuito");
  });

  it("nome repetido na própria planilha é acusado", () => {
    const l = conferir({ Pacientes: [paciente(), paciente()] });
    expect(l.pacientes).toHaveLength(1);
    expect(l.problemas[0].texto).toMatch(/mais de uma vez/);
  });

  it("linha totalmente vazia é só vazia — não vira erro", () => {
    const l = conferir({ Pacientes: [{ nome: "", formato_pagamento: "", valor_sessao: "" }] });
    expect(l.problemas).toEqual([]);
    expect(l.pacientes).toHaveLength(0);
  });
});

describe("Agenda e Pagamentos só falam de quem existe", () => {
  it("aceita paciente que está chegando na MESMA planilha", () => {
    const l = conferir({
      Pacientes: [paciente()],
      Agenda: [{ paciente: "maria souza lima", data: "05/02/2025", hora: "14:00", status: "realizada" }],
    });
    expect(l.problemas).toEqual([]);
    expect(l.sessoes[0]).toMatchObject({ status: "realizada", duracao: 50, online: false });
    expect(l.sessoes[0].quando).toEqual(new Date(2025, 1, 5, 14, 0));
  });

  it("aceita paciente que já estava cadastrado antes", () => {
    const l = conferir(
      { Pagamentos: [{ paciente: "Ana Lima", data: "10/02/2025", valor: "600,00", forma: "pix" }] },
      ["Ana Lima"],
    );
    expect(l.problemas).toEqual([]);
    expect(l.pagamentos[0]).toMatchObject({ valor: 600, forma: "pix", pagoPor: "Ana Lima" });
  });

  it("paciente desconhecido é recusado — importar agenda de ninguém é pior que não importar", () => {
    const l = conferir({ Agenda: [{ paciente: "Fantasma", data: "05/02/2025", hora: "14:00" }] });
    expect(l.sessoes).toHaveLength(0);
    expect(l.problemas[0].texto).toMatch(/não está na aba Pacientes/);
  });

  it("status vazio é 'agendada'; modalidade vazia é presencial", () => {
    const l = conferir({ Pacientes: [paciente()], Agenda: [{ paciente: "Maria Souza Lima", data: "05/02/2025", hora: "14:00" }] });
    expect(l.sessoes[0].status).toBe("agendada");
    expect(l.sessoes[0].online).toBe(false);
  });

  it("pagamento de valor zero ou negativo não entra", () => {
    const l = conferir({ Pagamentos: [{ paciente: "Ana", data: "10/02/2025", valor: "0" }] }, ["Ana"]);
    expect(l.pagamentos).toHaveLength(0);
    expect(l.problemas[0].coluna).toBe("valor");
  });

  it("sem 'pago por', quem pagou é o próprio paciente", () => {
    const l = conferir({ Pagamentos: [{ paciente: "Ana", data: "10/02/2025", valor: "100" }] }, ["Ana"]);
    expect(l.pagamentos[0].pagoPor).toBe("Ana");
  });
});

describe("os limites e o resumo", () => {
  it("acima do teto, corta e avisa", () => {
    const muitos = Array.from({ length: TETO_DE_LINHAS + 5 }, (_, i) => paciente({ nome: `Paciente ${i}` }));
    const l = conferir({ Pacientes: muitos });
    expect(l.pacientes.length).toBe(TETO_DE_LINHAS);
    expect(l.problemas.some((p) => /limite/.test(p.texto))).toBe(true);
  });

  it("o resumo conta o que entra e soma o dinheiro", () => {
    const l = conferir({
      Pacientes: [paciente()],
      Agenda: [{ paciente: "Maria Souza Lima", data: "05/02/2025", hora: "14:00" }],
      Pagamentos: [
        { paciente: "Maria Souza Lima", data: "10/02/2025", valor: "600,00" },
        { paciente: "Maria Souza Lima", data: "10/03/2025", valor: "150,50" },
      ],
    });
    expect(resumo(l)).toEqual({ pacientes: 1, sessoes: 1, pagamentos: 2, problemas: 0, dinheiro: 750.5 });
  });

  it("planilha vazia não quebra nada", () => {
    expect(resumo(conferir({}))).toEqual({ pacientes: 0, sessoes: 0, pagamentos: 0, problemas: 0, dinheiro: 0 });
  });
});
