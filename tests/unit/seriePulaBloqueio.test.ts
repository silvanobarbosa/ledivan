import { describe, expect, it } from "vitest";
import { datasDaRepeticao } from "@/lib/agendamentoNovo";

/**
 * A SÉRIE PULA O HORÁRIO BLOQUEADO (documento de 18/09).
 *
 * *"Se o horário estiver bloqueado, o agendamento não deverá ser realizado nesta data. O sistema
 * deverá pular a data do bloqueio e procurar a próxima data disponível, mantendo a sequência."*
 *
 * O exemplo dela: série semanal começando segunda 15/09 às 14h, com 22/09 bloqueado —
 * 15/09, **22/09 não**, 29/09, 06/10.
 *
 * O bloqueio mora em tabela própria, separada das sessões (ver `bloqueioDeHorario.ts`), e é só
 * isso que ele faz aqui: impedir que a data vire agendamento. Não vira sessão, não entra em
 * contagem de pacote, não vira dinheiro.
 */

const iso = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}h`;

/** Um "bloqueador" que recusa as datas listadas (dd/mm). */
const bloqueia = (...diasBloqueados: string[]) => (d: Date) =>
  diasBloqueados.includes(`${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`);

describe("semanal", () => {
  const primeira = new Date(2026, 8, 14, 14, 0); // segunda, 14/09
  const limite = new Date(2026, 9, 5, 23, 59, 59, 999);

  it("sem bloqueio, marca todas as segundas", () => {
    const d = datasDaRepeticao({ primeira, limite, freq: "semanal" });
    expect(d.map(iso)).toEqual(["14/09 14h", "21/09 14h", "28/09 14h", "05/10 14h"]);
  });

  it("a data bloqueada não vira agendamento, e a série segue", () => {
    const d = datasDaRepeticao({ primeira, limite, freq: "semanal", bloqueado: bloqueia("21/09") });
    expect(d.map(iso)).toEqual(["14/09 14h", "28/09 14h", "05/10 14h"]);
  });

  it("dois bloqueios seguidos também são pulados", () => {
    const d = datasDaRepeticao({ primeira, limite, freq: "semanal", bloqueado: bloqueia("21/09", "28/09") });
    expect(d.map(iso)).toEqual(["14/09 14h", "05/10 14h"]);
  });

  it("bloqueio na PRIMEIRA data: a série começa na seguinte", () => {
    const d = datasDaRepeticao({ primeira, limite, freq: "semanal", bloqueado: bloqueia("14/09") });
    expect(d.map(iso)).toEqual(["21/09 14h", "28/09 14h", "05/10 14h"]);
  });
});

describe("quinzenal", () => {
  it("pula o bloqueio e mantém o ritmo de quinze em quinze", () => {
    const d = datasDaRepeticao({
      primeira: new Date(2026, 8, 14, 9, 0),
      limite: new Date(2026, 9, 26, 23, 59, 59, 999),
      freq: "quinzenal",
      bloqueado: bloqueia("28/09"),
    });
    expect(d.map(iso)).toEqual(["14/09 09h", "12/10 09h", "26/10 09h"]);
  });
});

describe("2x na semana", () => {
  it("o bloqueio derruba só o dia bloqueado — o outro dia da semana continua", () => {
    // Segunda 14h + quarta 16h, com a quarta 23/09 bloqueada.
    const d = datasDaRepeticao({
      primeira: new Date(2026, 8, 14, 14, 0),
      limite: new Date(2026, 8, 30, 23, 59, 59, 999),
      freq: "semanal2x",
      segundoDia: 3,
      segundoHorario: "16:00",
      bloqueado: bloqueia("23/09"),
    });
    expect(d.map(iso)).toEqual(["14/09 14h", "16/09 16h", "21/09 14h", "28/09 14h", "30/09 16h"]);
  });
});

describe("sem bloqueador, nada muda", () => {
  it("quem não passa a função recebe a série inteira", () => {
    const d = datasDaRepeticao({
      primeira: new Date(2026, 8, 14, 14, 0),
      limite: new Date(2026, 8, 28, 23, 59),
      freq: "semanal",
    });
    expect(d).toHaveLength(3);
  });
});
