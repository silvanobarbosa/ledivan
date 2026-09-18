import { describe, it, expect } from "vitest";
import { idadeEmAnos, idadeEmPalavras } from "@/lib/idade";

const hoje = new Date(2026, 8, 11);   // 11/09/2026

describe("idade em anos", () => {
  it("conta os anos completos", () => {
    expect(idadeEmAnos(new Date(1990, 4, 20), hoje)).toBe(36);
  });

  // O caso que a divisão por milissegundos erra: o aniversário ainda não chegou este ano.
  it("quem faz aniversário depois ainda não fez anos", () => {
    expect(idadeEmAnos(new Date(1990, 10, 20), hoje)).toBe(35);
  });

  it("quem faz aniversário HOJE já tem a idade nova", () => {
    expect(idadeEmAnos(new Date(1990, 8, 11), hoje)).toBe(36);
  });

  it("um dia antes do aniversário ainda é a idade antiga", () => {
    expect(idadeEmAnos(new Date(1990, 8, 12), hoje)).toBe(35);
  });

  it("bebê deste ano tem 0", () => {
    expect(idadeEmAnos(new Date(2026, 2, 1), hoje)).toBe(0);
  });

  // Sem data não se inventa faixa etária: é null, e a tela mostra vazio.
  it("sem data de nascimento, não há idade", () => {
    expect(idadeEmAnos(null, hoje)).toBeNull();
    expect(idadeEmAnos(undefined, hoje)).toBeNull();
    expect(idadeEmAnos("", hoje)).toBeNull();
    expect(idadeEmAnos("qualquer coisa", hoje)).toBeNull();
  });

  it("data no futuro não vira idade negativa", () => {
    expect(idadeEmAnos(new Date(2030, 0, 1), hoje)).toBeNull();
  });

  it("aceita texto ISO, que é como vem do formulário", () => {
    expect(idadeEmAnos("1990-05-20T12:00:00", hoje)).toBe(36);
  });
});

describe("idade escrita", () => {
  it("adulto em anos", () => {
    expect(idadeEmPalavras(new Date(1990, 4, 20), hoje)).toBe("36 anos");
  });

  it("um ano é singular", () => {
    expect(idadeEmPalavras(new Date(2025, 4, 20), hoje)).toBe("1 ano");
  });

  // "0 anos" não diz nada a quem atende criança pequena.
  it("bebê aparece em meses", () => {
    expect(idadeEmPalavras(new Date(2026, 2, 11), hoje)).toBe("6 meses");
    expect(idadeEmPalavras(new Date(2026, 7, 11), hoje)).toBe("1 mês");
  });

  it("sem data, texto vazio", () => {
    expect(idadeEmPalavras(null, hoje)).toBe("");
  });
});

describe("a data que vem do banco não anda um dia (18/09)", () => {
  /**
   * A data de nascimento é data de CALENDÁRIO. Ela nasce meia-noite sem fuso e, lida como UTC num
   * fuso negativo, recua um dia — era o mesmo defeito da lista de aniversariantes, onde 21/09
   * aparecia como 20/09.
   *
   * Aqui isso fazia a pessoa "fazer aniversário" um dia antes: em 20/09 já contava a idade nova.
   */
  const nascidoEm21DeSetembro = "1984-09-21T00:00:00.000Z";

  it("no dia 20 ainda não fez aniversário", () => {
    expect(idadeEmAnos(nascidoEm21DeSetembro, new Date(2026, 8, 20))).toBe(41);
  });

  it("no dia 21 faz", () => {
    expect(idadeEmAnos(nascidoEm21DeSetembro, new Date(2026, 8, 21))).toBe(42);
  });
});
