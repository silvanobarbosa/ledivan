import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "@/lib/therapy";

/**
 * A DATA NÃO PODE ANDAR UM DIA NO CAMINHO ATÉ A TELA.
 *
 * Relato de quem usa: "a data do aniversário aparece um dia antes — e no histórico de ajuste
 * também". São dois sintomas com uma causa só.
 *
 * O caminho do erro é o mesmo que `horaLocal.ts` já descreve para o HORÁRIO, e que aqui aparece na
 * DATA: a coluna é `timestamp` sem fuso, guardando data de parede. Quando o valor chega como
 * meia-noite ("2026-09-21T00:00:00.000Z"), `new Date()` o lê como UTC, e num fuso negativo
 * (UTC−3) o relógio recua para as 21h do dia **20**. `toLocaleDateString` então desenha o dia
 * anterior — e o aniversário de 21 vira 20.
 *
 * Meio-dia não falha porque ±3h não cruza a virada do dia; é por isso que o defeito aparecia só em
 * alguns registros, o que fazia parecer aleatório.
 */
describe("a data chega inteira na tela", () => {
  it("meia-noite não vira o dia anterior", () => {
    expect(formatDate("2026-09-21T00:00:00.000Z")).toContain("21");
    expect(formatDate("2026-01-01T00:00:00.000Z")).toContain("01");
  });

  it("a virada do ano não recua para dezembro", () => {
    const texto = formatDate("2026-01-01T00:00:00.000Z");
    expect(texto).toContain("2026");
    expect(texto).not.toContain("dez");
  });

  it("data no meio do dia continua certa", () => {
    expect(formatDate("2026-09-21T12:00:00.000Z")).toContain("21");
  });

  it("data sem fuso é lida como está", () => {
    expect(formatDate("2026-09-21T00:00:00")).toContain("21");
  });

  it("nulo continua sendo travessão", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("data e hora juntas", () => {
  it("meia-noite mantém o dia e mostra 00:00", () => {
    const texto = formatDateTime("2026-09-21T00:00:00.000Z");
    expect(texto).toContain("21/09");
    expect(texto).toContain("00:00");
  });

  it("o horário marcado não anda", () => {
    expect(formatDateTime("2026-09-21T18:30:00.000Z")).toContain("18:30");
  });
});
