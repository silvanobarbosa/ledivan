import { describe, it, expect } from "vitest";
import { anoDe, anosDisponiveis, doAno } from "@/lib/filtroDeAno";

describe("o ano sai do texto, não do fuso", () => {
  /**
   * Este app já viu data andar um dia por causa de fuso. Num filtro de ano isso é pior: a sessão
   * de 1º de janeiro sumiria do ano em que aconteceu, e ninguém entenderia por quê.
   */
  it("data de parede", () => {
    expect(anoDe("2026-09-01T09:00:00")).toBe(2026);
    expect(anoDe("2025-12-31T23:30:00")).toBe(2025);
  });

  it("1º de janeiro pertence ao ano dele, sem exceção", () => {
    expect(anoDe("2026-01-01T00:00:00")).toBe(2026);
  });

  it("Date também serve", () => {
    expect(anoDe(new Date(2024, 5, 10))).toBe(2024);
  });

  it("vazio não inventa ano", () => {
    expect(anoDe(null)).toBeNull();
    expect(anoDe("")).toBeNull();
    expect(anoDe("sem data")).toBeNull();
  });
});

describe("os anos oferecidos no seletor", () => {
  const agora = new Date(2026, 8, 17);

  it("vêm do dado, do mais recente para o mais antigo", () => {
    expect(anosDisponiveis(["2024-03-01T09:00:00", "2026-01-02T09:00:00", "2025-07-01T09:00:00"], agora))
      .toEqual([2026, 2025, 2024]);
  });

  it("sem repetir", () => {
    expect(anosDisponiveis(["2026-01-01T09:00:00", "2026-08-01T09:00:00"], agora)).toEqual([2026]);
  });

  it("o ano corrente aparece mesmo sem nenhum dado nele", () => {
    // Quem abre em janeiro, antes da primeira sessão, precisa poder escolher o ano em que está.
    expect(anosDisponiveis(["2025-05-01T09:00:00"], agora)).toEqual([2026, 2025]);
  });

  it("lista vazia devolve só o ano corrente", () => {
    expect(anosDisponiveis([], agora)).toEqual([2026]);
  });
});

describe("filtrar pelo ano escolhido", () => {
  const linhas = [
    { id: "a", data: "2026-09-01T09:00:00" },
    { id: "b", data: "2025-09-01T09:00:00" },
    { id: "c", data: "2026-01-01T00:00:00" },
    { id: "d", data: null },
  ];
  const dataDe = (l: (typeof linhas)[number]) => l.data;

  it("fica só o que é do ano", () => {
    expect(doAno(linhas, 2026, dataDe).map((l) => l.id)).toEqual(["a", "c"]);
    expect(doAno(linhas, 2025, dataDe).map((l) => l.id)).toEqual(["b"]);
  });

  it("linha sem data não entra em ano nenhum", () => {
    expect(doAno(linhas, 2026, dataDe).some((l) => l.id === "d")).toBe(false);
  });

  it("sem ano escolhido, não filtra nada — e não some com dado", () => {
    expect(doAno(linhas, null, dataDe)).toHaveLength(4);
  });

  it("ano sem nada devolve vazio, não a lista inteira", () => {
    expect(doAno(linhas, 2019, dataDe)).toEqual([]);
  });
});
