import { describe, expect, it } from "vitest";
import { remanejamento } from "@/lib/remanejamento";

/**
 * REMANEJAR A AGENDA DEPOIS DE DESBLOQUEAR (documento de 19/09).
 *
 * *"Se o horário de 22/09 for desbloqueado, o registro de 'Hor. Bloq.' deverá ser removido e a
 * sequência deverá ser reorganizada para que a sessão ocupe aquela data."*
 *
 * | antes  |      | depois |     |
 * |--------|------|--------|-----|
 * | 15/09  | 1/4  | 15/09  | 1/4 |
 * | 22/09  | Hor. Bloq. | 22/09 | 2/4 |
 * | 29/09  | 2/4  | 29/09  | 3/4 |
 * | 06/10  | 3/4  | 06/10  | 4/4 |
 * | 13/10  | 4/4  | —      |     |
 *
 * Cada sessão anda para a data da anterior — em cascata. Não é preciso saber se a série é semanal
 * ou quinzenal: o intervalo já está nas próprias datas, e usá-las evita inventar um ritmo que a
 * terapeuta pode ter mudado na mão.
 */

const dia = (d: number, mes = 8, status = "agendada") => ({
  id: `s${mes}-${d}`,
  date: new Date(2026, mes, d, 14),
  status,
});

const legivel = (ms: { id: string; de: Date; para: Date }[]) =>
  ms.map((m) => `${m.id}: ${String(m.de.getDate()).padStart(2, "0")}/${m.de.getMonth() + 1} → ${String(m.para.getDate()).padStart(2, "0")}/${m.para.getMonth() + 1}`);

describe("o exemplo dela", () => {
  const vaga = new Date(2026, 8, 22, 14);
  const sessoes = [dia(15, 8, "realizada"), dia(29), dia(6, 9), dia(13, 9)];

  it("cada sessão anda para a data da anterior, e a primeira ocupa a vaga", () => {
    expect(legivel(remanejamento(vaga, sessoes))).toEqual([
      "s8-29: 29/9 → 22/9",
      "s9-6: 06/10 → 29/9",
      "s9-13: 13/10 → 06/10",
    ]);
  });

  it("a sessão que já aconteceu não se mexe", () => {
    expect(remanejamento(vaga, sessoes).some((m) => m.id === "s8-15")).toBe(false);
  });
});

describe("o que não se mexe", () => {
  it("sessão ANTES da vaga fica onde está", () => {
    const ms = remanejamento(new Date(2026, 8, 22, 14), [dia(8), dia(29)]);
    expect(ms.map((m) => m.id)).toEqual(["s8-29"]);
  });

  it("sessão já realizada, faltada ou desmarcada não anda", () => {
    const ms = remanejamento(new Date(2026, 8, 22, 14), [
      dia(29, 8, "realizada"), dia(6, 9, "cancelada"), dia(13, 9, "nao_realizada"), dia(20, 9),
    ]);
    // Só a agendada de 20/10 anda — e vai para a vaga, porque é a primeira que pode.
    expect(legivel(ms)).toEqual(["s9-20: 20/10 → 22/9"]);
  });

  it("sem nenhuma sessão depois da vaga, não há o que remanejar", () => {
    expect(remanejamento(new Date(2026, 9, 30, 14), [dia(15), dia(29)])).toEqual([]);
  });

  it("horário diferente da vaga não impede: a data é que manda", () => {
    // A vaga é 22/09 às 14h e a série é às 14h; se a terapeuta tivesse mudado o horário de uma
    // sessão, ela ainda assim anda — o que se preserva é a ORDEM, não o relógio.
    const ms = remanejamento(new Date(2026, 8, 22, 14), [{ id: "x", date: new Date(2026, 8, 29, 16), status: "agendada" }]);
    expect(ms[0].para.getHours()).toBe(14);
  });
});
