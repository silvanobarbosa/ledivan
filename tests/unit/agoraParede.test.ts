import { describe, expect, it } from "vitest";
import { agoraParede, horaDeParede } from "@/lib/horaLocal";

// Doc 34 (G7): os horários das guias saíam 3h adiantados porque gravávamos o instante UTC
// (`new Date()` na Vercel) e a tela lê os componentes UTC como hora de parede. `agoraParede` grava
// os componentes UTC já no relógio de São Paulo, então a tela mostra a hora certa.
describe("agoraParede grava a hora de parede de SP (doc 34 G7)", () => {
  it("14:00 UTC → componentes UTC do resultado são 11:00 (SP, UTC-3)", () => {
    const d = agoraParede(new Date("2026-06-15T14:00:00Z"));
    expect(d.getUTCHours()).toBe(11);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCMonth()).toBe(5); // junho
  });

  it("02:00 UTC do dia 2 → 23:00 do dia 1 em SP (vira o dia)", () => {
    const d = agoraParede(new Date("2026-06-02T02:00:00Z"));
    expect(d.getUTCHours()).toBe(23);
    expect(d.getUTCDate()).toBe(1);
  });

  it("horaDeParede do que agoraParede grava bate com o relógio de SP", () => {
    const d = agoraParede(new Date("2026-06-15T14:30:00Z"));
    // horaDeParede lê os componentes UTC → "2026-06-15T11:30:00".
    expect(horaDeParede(d)).toBe("2026-06-15T11:30:00");
  });
});
