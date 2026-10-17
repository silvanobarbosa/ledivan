import { describe, it, expect } from "vitest";
import { datasRecorrentes } from "@/lib/recorrencia";

describe("datasRecorrentes", () => {
  it("gera N datas mensais mantendo o dia", () => {
    expect(datasRecorrentes("2026-01-10", 3)).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
  });

  it("gruda no último dia quando o mês de destino é mais curto", () => {
    expect(datasRecorrentes("2026-01-31", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("respeita ano bissexto (2028 tem 29/02)", () => {
    expect(datasRecorrentes("2028-01-31", 2)).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("vira o ano", () => {
    expect(datasRecorrentes("2026-11-15", 3)).toEqual(["2026-11-15", "2026-12-15", "2027-01-15"]);
  });

  it("meses < 1 vira só a própria data", () => {
    expect(datasRecorrentes("2026-05-20", 0)).toEqual(["2026-05-20"]);
    expect(datasRecorrentes("2026-05-20", -4)).toEqual(["2026-05-20"]);
  });

  it("data inválida devolve vazio", () => {
    expect(datasRecorrentes("xx", 3)).toEqual([]);
  });
});
