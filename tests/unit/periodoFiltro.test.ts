import { describe, it, expect } from "vitest";
import { dentroDoIntervalo, intervaloDoPeriodo, periodoDaUrl, PERIODO_PADRAO, rotuloDoIntervalo } from "@/lib/periodoFiltro";

const hoje = new Date(2026, 9, 27, 11, 0, 0); // 27/10/2026

describe("doc 64: o recorte por período da tela de Transações", () => {
  it("ao entrar, vale o MÊS ATUAL", () => {
    expect(PERIODO_PADRAO).toBe("mes");
    expect(periodoDaUrl(null)).toBe("mes");
    expect(periodoDaUrl("bobagem")).toBe("mes");
    expect(periodoDaUrl("12m")).toBe("12m");
  });

  it("o mês atual vai do dia 1 ao último dia — o que ainda vai vencer continua à vista", () => {
    expect(intervaloDoPeriodo("mes", hoje)).toEqual({ de: "2026-10-01", ate: "2026-10-31" });
  });

  it("6 e 12 meses são de CALENDÁRIO e incluem o mês corrente inteiro", () => {
    expect(intervaloDoPeriodo("6m", hoje)).toEqual({ de: "2026-05-01", ate: "2026-10-31" });
    expect(intervaloDoPeriodo("12m", hoje)).toEqual({ de: "2025-11-01", ate: "2026-10-31" });
  });

  it("tudo não tem ponta nenhuma", () => {
    expect(intervaloDoPeriodo("tudo", hoje)).toEqual({ de: null, ate: null });
  });

  it("o intervalo escolhido à mão passa como está, e lixo vira ponta aberta", () => {
    expect(intervaloDoPeriodo("custom", hoje, "2025-03-01", "2025-03-31")).toEqual({ de: "2025-03-01", ate: "2025-03-31" });
    expect(intervaloDoPeriodo("custom", hoje, "", "2025-03-31")).toEqual({ de: null, ate: "2025-03-31" });
    expect(intervaloDoPeriodo("custom", hoje, "ontem", null)).toEqual({ de: null, ate: null });
  });

  it("fevereiro não vira 31 nem 30 de fevereiro", () => {
    expect(intervaloDoPeriodo("mes", new Date(2024, 1, 15))).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
    expect(intervaloDoPeriodo("mes", new Date(2026, 1, 15))).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
  });

  it("as pontas são inclusivas", () => {
    const i = { de: "2026-10-01", ate: "2026-10-31" };
    expect(dentroDoIntervalo("2026-10-01", i)).toBe(true);
    expect(dentroDoIntervalo("2026-10-31", i)).toBe(true);
    expect(dentroDoIntervalo("2026-09-30", i)).toBe(false);
    expect(dentroDoIntervalo("2026-11-01", i)).toBe(false);
  });

  it("a comparação é por TEXTO: o horário não empurra a data para o dia anterior", () => {
    const i = { de: "2026-10-01", ate: "2026-10-31" };
    expect(dentroDoIntervalo("2026-10-01T00:00:00", i)).toBe(true);
    expect(dentroDoIntervalo("2026-10-31T23:30:00", i)).toBe(true);
  });

  it("sem data, não cai em intervalo nenhum", () => {
    expect(dentroDoIntervalo(null, { de: null, ate: null })).toBe(false);
    expect(dentroDoIntervalo("", { de: null, ate: null })).toBe(false);
  });

  it("o rótulo diz o recorte", () => {
    expect(rotuloDoIntervalo("mes", intervaloDoPeriodo("mes", hoje))).toBe("Mês atual");
    expect(rotuloDoIntervalo("tudo", { de: null, ate: null })).toBe("Tudo");
    expect(rotuloDoIntervalo("custom", { de: "2025-03-01", ate: "2025-03-31" })).toBe("01/03/2025 → 31/03/2025");
  });
});
