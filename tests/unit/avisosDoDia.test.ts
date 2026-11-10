import { describe, expect, it } from "vitest";
import { NOMES_NO_AVISO, avisoDeAniversario, avisoDeVencimento, diaEAniversario } from "@/lib/avisosDoDia";

describe("aviso de aniversário", () => {
  it("um aniversariante: o título fala no singular", () => {
    expect(avisoDeAniversario(["Marina Teixeira"])).toEqual({
      title: "Hoje é aniversário do paciente:",
      body: "Marina Teixeira",
    });
  });

  it("dois ou mais: plural, um nome por linha", () => {
    const a = avisoDeAniversario(["Marina", "Sarah"]);
    expect(a?.title).toBe("Hoje é aniversário dos pacientes:");
    expect(a?.body).toBe("Marina\nSarah");
  });

  it("ninguém faz aniversário: não há aviso", () => {
    expect(avisoDeAniversario([])).toBeNull();
    expect(avisoDeAniversario(["  ", ""])).toBeNull();
  });

  it("lista longa corta no teto e diz quantos ficaram de fora", () => {
    const nomes = Array.from({ length: NOMES_NO_AVISO + 3 }, (_, i) => `Paciente ${i + 1}`);
    const linhas = avisoDeAniversario(nomes)!.body.split("\n");
    expect(linhas).toHaveLength(NOMES_NO_AVISO + 1);
    expect(linhas.at(-1)).toBe("e mais 3");
  });

  it("no teto exato ainda não há linha de sobra", () => {
    const nomes = Array.from({ length: NOMES_NO_AVISO }, (_, i) => `P${i}`);
    expect(avisoDeAniversario(nomes)!.body.split("\n")).toHaveLength(NOMES_NO_AVISO);
  });
});

describe("aviso de vencimento", () => {
  it("paciente e valor, nas palavras do documento", () => {
    expect(avisoDeVencimento([{ nome: "Thayná", valor: 340 }])).toEqual({
      title: "Pacotes e sessões a vencer hoje.",
      body: "Paciente: Thayná valor: R$ 340,00",
    });
  });

  it("valor quebrado sai em reais, com vírgula", () => {
    expect(avisoDeVencimento([{ nome: "Sarah", valor: 87.5 }])?.body).toBe("Paciente: Sarah valor: R$ 87,50");
  });

  it("nada vencendo: não há aviso", () => {
    expect(avisoDeVencimento([])).toBeNull();
  });
});

describe("o dia de hoje", () => {
  it("devolve o dia e o mês-dia do aniversário, sem passar por fuso", () => {
    expect(diaEAniversario(new Date(2026, 10, 9, 23, 30))).toEqual({ diaISO: "2026-11-09", mesDia: "11-09" });
  });

  it("vira o ano sem escorregar de dia", () => {
    expect(diaEAniversario(new Date(2026, 0, 1, 0, 5))).toEqual({ diaISO: "2026-01-01", mesDia: "01-01" });
  });
});
