import { describe, it, expect } from "vitest";
import { occurrences, endFromDuration, weekdayIndex } from "@/lib/recurrence";

describe("endFromDuration", () => {
  it("soma anos", () => {
    const e = endFromDuration(new Date(2026,0,15), 1, "anos");
    expect(e.getFullYear()).toBe(2027);
    expect(e.getMonth()).toBe(0);
  });
  it("soma meses", () => {
    const e = endFromDuration(new Date(2026,0,15), 3, "meses");
    expect(e.getMonth()).toBe(3); // abril
  });
  it("limita entre 1 e 5", () => {
    expect(endFromDuration(new Date(2026,0,1), 0, "anos").getFullYear()).toBe(2027);
    expect(endFromDuration(new Date(2026,0,1), 99, "anos").getFullYear()).toBe(2031);
  });
});

describe("weekdayIndex", () => {
  it("resolve dias PT-BR", () => {
    expect(weekdayIndex("segunda")).toBe(1);
    expect(weekdayIndex("terça-feira")).toBe(2);
    expect(weekdayIndex("SÁBADO")).toBe(6);
    expect(weekdayIndex("")).toBeUndefined();
  });
});

describe("occurrences", () => {
  // 2026-01-05 é uma segunda-feira.
  const base = { weekday: 1, hour: 9, minute: 0, start: new Date(2026,0,1), freq: "semanal" as const };

  it("semanal por ~1 ano gera ~52 ocorrências", () => {
    const list = occurrences({ ...base, end: endFromDuration(new Date(2026,0,1), 1, "anos") });
    expect(list.length).toBeGreaterThanOrEqual(52);
    expect(list.length).toBeLessThanOrEqual(53);
    for (const d of list) expect(d.getDay()).toBe(1); // sempre segunda
    expect(list[0].getHours()).toBe(9);
  });

  it("quinzenal gera metade (passo 14 dias)", () => {
    const list = occurrences({ ...base, freq: "quinzenal", end: endFromDuration(new Date(2026,0,1), 1, "anos") });
    expect(list.length).toBeGreaterThanOrEqual(26);
    expect(list.length).toBeLessThanOrEqual(27);
    // diferença entre ocorrências = 14 dias
    const diff = (list[1].getTime() - list[0].getTime()) / 86400000;
    expect(diff).toBe(14);
  });

  it("mensal ~12 no ano", () => {
    const list = occurrences({ ...base, freq: "mensal", end: endFromDuration(new Date(2026,0,1), 1, "anos") });
    expect(list.length).toBeGreaterThanOrEqual(11);
    expect(list.length).toBeLessThanOrEqual(13);
  });

  it("respeita o teto maxCount", () => {
    const list = occurrences({ ...base, end: endFromDuration(new Date(2026,0,1), 5, "anos"), maxCount: 10 });
    expect(list.length).toBe(10);
  });
});
