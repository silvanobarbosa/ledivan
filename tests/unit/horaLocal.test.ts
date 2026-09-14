import { describe, expect, it } from "vitest";
import { horaDeParede, horaDeParedeOuNulo } from "@/lib/horaLocal";

/**
 * A hora marcada não pode andar no caminho até a tela.
 *
 * Agendou 6h, a agenda mostrou 3h. Provado na produção: banco com 12:00, 13:00 e 18:00; tela
 * desenhando 09:00, 10:00 e 15:00. Três horas a menos em TODAS as sessões.
 *
 * As datas aqui são montadas com `Date.UTC` de propósito: é assim que o Drizzle entrega uma coluna
 * `timestamp` sem fuso — a hora de parede fica nos campos UTC. Montá-las como hora local testaria
 * outra coisa. Com `Z`, o navegador desconta o fuso dele; sem, lê como hora local
 * e nada se move.
 */

describe("o texto que atravessa para a tela", () => {
  it("carrega a hora de parede, não o UTC", () => {
    const d = new Date(Date.UTC(2026, 8, 13, 18, 0, 0));
    expect(horaDeParede(d)).toBe("2026-09-13T18:00:00");
  });

  it("NÃO leva o Z — é o Z que move o horário", () => {
    // `new Date("...Z")` no navegador desconta o fuso dele. Sem o Z, ele lê como hora local.
    expect(horaDeParede(new Date(Date.UTC(2026, 8, 13, 6, 0, 0)))).not.toContain("Z");
  });

  it("o navegador lê de volta a MESMA hora", () => {
    const original = new Date(Date.UTC(2026, 8, 13, 6, 0, 0));
    const naVolta = new Date(horaDeParede(original));
    expect(naVolta.getHours()).toBe(6);
    expect(naVolta.getDate()).toBe(13);
  });

  it("meia-noite e fim de dia não viram outro dia", () => {
    expect(horaDeParede(new Date(Date.UTC(2026, 8, 13, 0, 0, 0)))).toBe("2026-09-13T00:00:00");
    expect(horaDeParede(new Date(Date.UTC(2026, 8, 13, 23, 59, 0)))).toBe("2026-09-13T23:59:00");
  });

  it("os números vêm com dois dígitos", () => {
    expect(horaDeParede(new Date(Date.UTC(2026, 0, 5, 8, 7, 3)))).toBe("2026-01-05T08:07:03");
  });

  it("texto SEM fuso já é hora de parede e passa intacto", () => {
    // Passá-lo por  e reler pelos campos UTC o deslocaria — o texto já é a resposta.
    expect(horaDeParede("2026-09-13T18:30:00")).toBe("2026-09-13T18:30:00");
    expect(horaDeParede("2026-09-13 18:30:00")).toBe("2026-09-13T18:30:00");
    expect(horaDeParede("2026-09-13T18:30")).toBe("2026-09-13T18:30:00");
  });
});

describe("o que não é data", () => {
  it("nulo vira vazio", () => {
    expect(horaDeParede(null)).toBe("");
    expect(horaDeParede(undefined)).toBe("");
  });

  it("data inválida vira vazio em vez de NaN na tela", () => {
    expect(horaDeParede("nada")).toBe("");
  });

  it("a versão opcional devolve nulo, para os campos que aceitam nulo", () => {
    expect(horaDeParedeOuNulo(null)).toBeNull();
    expect(horaDeParedeOuNulo("nada")).toBeNull();
    expect(horaDeParedeOuNulo(new Date(Date.UTC(2026, 8, 13, 9, 0, 0)))).toBe("2026-09-13T09:00:00");
  });
});
