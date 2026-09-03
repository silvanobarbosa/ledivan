import { describe, it, expect } from "vitest";
import { monthKeys, buildForecast } from "@/lib/forecast";

describe("monthKeys", () => {
  it("gera N meses sequenciais virando o ano", () => {
    const k = monthKeys(2026, 10, 4); // nov/26 …
    expect(k.map((x) => x.ym)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(k[0].label).toBe("nov/26");
    expect(k[2].label).toBe("jan/27");
  });
});

describe("buildForecast", () => {
  const keys = monthKeys(2026, 8, 3); // set,out,nov /26

  it("separa agendado vs pacotes sem dupla contagem", () => {
    const f = buildForecast(keys, [
      { ym: "2026-09", fee: 200, packageId: null, patientId: "a" },
      { ym: "2026-09", fee: 150, packageId: "p1", patientId: "b" },
      { ym: "2026-10", fee: 200, packageId: null, patientId: "a" },
    ], [], []);
    expect(f.months[0].agendado).toBe(200);
    expect(f.months[0].pacotes).toBe(150);
    expect(f.subtotals.agendado).toBe(400);
    expect(f.subtotals.pacotes).toBe(150);
    expect(f.subtotals.total).toBe(550);
  });

  it("recorrência preenche só o GAP acima do que já está marcado", () => {
    // paciente semanal (4/mês), fee 100; em set só 1 sessão marcada -> gap 3*100=300
    const f = buildForecast(keys,
      [{ ym: "2026-09", fee: 100, packageId: null, patientId: "a" }],
      [{ patientId: "a", fee: 100, perMonth: 4 }],
      []);
    expect(f.months[0].agendado).toBe(100);
    expect(f.months[0].recorrencia).toBe(300); // 3 sessões faltantes
    expect(f.months[1].recorrencia).toBe(400); // out sem marcadas -> 4*100
  });

  it("reajuste aplica delta × sessões esperadas a partir do mês efetivo", () => {
    const f = buildForecast(keys, [],
      [{ patientId: "a", fee: 100, perMonth: 4 }],
      [{ patientId: "a", ym: "2026-10", newFee: 120, oldFee: 100 }]);
    expect(f.months[0].reajuste).toBe(0);      // set: antes do reajuste
    expect(f.months[1].reajuste).toBe(80);     // out: (120-100)*4
    expect(f.months[2].reajuste).toBe(80);     // nov
  });

  it("total soma os 4 baldes por mês", () => {
    const f = buildForecast(keys,
      [{ ym: "2026-09", fee: 200, packageId: null, patientId: "a" }, { ym: "2026-09", fee: 150, packageId: "p1", patientId: "b" }],
      [{ patientId: "a", fee: 200, perMonth: 1 }],
      []);
    const m = f.months[0];
    expect(m.total).toBe(m.agendado + m.pacotes + m.recorrencia + m.reajuste);
  });
});
