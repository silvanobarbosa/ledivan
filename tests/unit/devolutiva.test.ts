import { describe, it, expect } from "vitest";
import { proximaDevolutiva, diasParaDevolutiva, devolutivaNaLista } from "@/lib/devolutiva";

const d = (s: string) => new Date(s + "T12:00:00");

describe("proximaDevolutiva", () => {
  it("1ª = primeira sessão + meses (sem devolutiva ainda)", () => {
    expect(proximaDevolutiva(d("2026-01-10"), null, 3)).toEqual(d("2026-04-10"));
  });
  it("próxima = última devolutiva + meses", () => {
    expect(proximaDevolutiva(d("2026-01-10"), d("2026-04-10"), 3)).toEqual(d("2026-07-10"));
  });
  it("sem intervalo ou sem base → null", () => {
    expect(proximaDevolutiva(d("2026-01-10"), null, null)).toBeNull();
    expect(proximaDevolutiva(null, null, 3)).toBeNull();
  });
  it("mês curto cai no último dia", () => {
    expect(proximaDevolutiva(d("2026-01-31"), null, 1)).toEqual(d("2026-02-28"));
  });
});

describe("devolutivaNaLista", () => {
  const hoje = d("2026-04-05");
  it("entra quando falta ≤ 7 dias", () => {
    expect(devolutivaNaLista(d("2026-04-10"), null, hoje)).toBe(true); // 5 dias
  });
  it("não entra quando falta mais de 7 dias", () => {
    expect(devolutivaNaLista(d("2026-04-20"), null, hoje)).toBe(false);
  });
  it("entra quando já venceu (negativo) e não foi dispensada", () => {
    expect(devolutivaNaLista(d("2026-04-01"), null, hoje)).toBe(true);
  });
  it("dispensada neste ciclo não aparece; ciclo novo reaparece", () => {
    const prox = d("2026-04-10");
    expect(devolutivaNaLista(prox, prox, hoje)).toBe(false);          // dispensou esta
    const proxNova = d("2026-07-10");
    expect(devolutivaNaLista(proxNova, prox, d("2026-07-05"))).toBe(true); // ciclo seguinte
  });
});

describe("diasParaDevolutiva", () => {
  it("conta dias e aceita negativo", () => {
    expect(diasParaDevolutiva(d("2026-04-10"), d("2026-04-05"))).toBe(5);
    expect(diasParaDevolutiva(d("2026-04-01"), d("2026-04-05"))).toBe(-4);
  });
});
