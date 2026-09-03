import { describe, it, expect } from "vitest";
import { derivePackageLabels } from "@/lib/packages";
import { occurrencesByCount } from "@/lib/recurrence";

describe("derivePackageLabels", () => {
  const pkg = [{ id: "p1", seq: 1, sessions: 4 }];

  it("numera 1/4, 2/4… por ordem de data", () => {
    const sessions = [
      { id: "c", date: "2026-09-19", status: "agendada", packageId: "p1" },
      { id: "a", date: "2026-09-05", status: "agendada", packageId: "p1" },
      { id: "b", date: "2026-09-12", status: "agendada", packageId: "p1" },
    ];
    const m = derivePackageLabels(sessions, pkg);
    expect(m.get("a")).toEqual({ seq: 1, index: 1, total: 4 });
    expect(m.get("b")).toEqual({ seq: 1, index: 2, total: 4 });
    expect(m.get("c")).toEqual({ seq: 1, index: 3, total: 4 });
  });

  it("renumera: cancelar a 2/4 faz a 3/4 virar 2/4", () => {
    const sessions = [
      { id: "a", date: "2026-09-05", status: "agendada", packageId: "p1" },
      { id: "b", date: "2026-09-12", status: "cancelada", packageId: "p1" }, // saiu
      { id: "c", date: "2026-09-19", status: "agendada", packageId: "p1" },
      { id: "d", date: "2026-09-26", status: "agendada", packageId: "p1" },
    ];
    const m = derivePackageLabels(sessions, pkg);
    expect(m.get("a")!.index).toBe(1);
    expect(m.has("b")).toBe(false); // cancelada não numera
    expect(m.get("c")!.index).toBe(2); // assumiu o lugar da 2
    expect(m.get("d")!.index).toBe(3);
  });

  it("ignora sessões sem pacote ou de pacote inexistente", () => {
    const sessions = [
      { id: "a", date: "2026-09-05", status: "agendada", packageId: null },
      { id: "b", date: "2026-09-12", status: "agendada", packageId: "zzz" },
    ];
    const m = derivePackageLabels(sessions, pkg);
    expect(m.size).toBe(0);
  });
});

describe("occurrencesByCount", () => {
  // 2026-09-01 é terça; weekday 1 (segunda) → primeira segunda = 2026-09-07.
  it("gera exatamente N ocorrências no passo da frequência", () => {
    const list = occurrencesByCount(1, 9, 0, new Date(2026, 8, 1), "quinzenal", 4);
    expect(list.length).toBe(4);
    for (const d of list) expect(d.getDay()).toBe(1);
    const diff = (list[1].getTime() - list[0].getTime()) / 86400000;
    expect(diff).toBe(14);
  });

  it("N=0 devolve vazio; limita a 60", () => {
    expect(occurrencesByCount(1, 9, 0, new Date(2026, 8, 1), "semanal", 0).length).toBe(0);
    expect(occurrencesByCount(1, 9, 0, new Date(2026, 8, 1), "semanal", 999).length).toBe(60);
  });
});
