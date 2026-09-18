import { describe, expect, it } from "vitest";
import { datasDaRepeticao, geraRepeticoes, repeticoesDe, segundoDiaValido } from "@/lib/agendamentoNovo";

/**
 * SEMANAL (2x NA SEMANA) — documento de 18/09.
 *
 * A terapeuta escolhe "Semanal (2x na semana)" na repetição do agendamento; o primeiro dia e
 * horário já vêm do próprio agendamento, e ela informa só o **segundo dia da semana e o horário**.
 * O sistema marca as duas séries, e o pacote passa a valer oito sessões.
 *
 * O exemplo dela, que virou teste: segunda 14h + quarta 16h, começando em 14/09 —
 * 14/09, 16/09, 21/09, 23/09, 28/09, 30/09, 05/10, 07/10.
 */

const iso = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}h`;

describe("a opção na janela", () => {
  it("aparece entre semanal e quinzenal", () => {
    const rotulos = repeticoesDe({}).map((r) => r.rotulo);
    expect(rotulos).toEqual([
      "Não repetir",
      "Semanal (1x na semana)",
      "Semanal (2x na semana)",
      "Quinzenal",
      "Mensal",
    ]);
  });

  it("gera agendamentos, como a semanal e a quinzenal", () => {
    expect(geraRepeticoes("semanal2x")).toBe(true);
  });

  it("não é oferecida na devolutiva nem no slot intercalado", () => {
    expect(repeticoesDe({ tipo: "devolutiva" }).map((r) => r.valor)).toEqual(["pontual"]);
    expect(repeticoesDe({ slotIntercalado: true }).some((r) => r.valor === "semanal2x")).toBe(false);
  });
});

describe("o segundo dia", () => {
  it("é obrigatório quando a repetição é 2x na semana", () => {
    expect(segundoDiaValido("semanal2x", null, "16:00")).toBe(false);
    expect(segundoDiaValido("semanal2x", 3, "")).toBe(false);
    expect(segundoDiaValido("semanal2x", 3, "16:00")).toBe(true);
  });

  it("não é pedido nas outras repetições", () => {
    expect(segundoDiaValido("semanal", null, "")).toBe(true);
    expect(segundoDiaValido("quinzenal", null, "")).toBe(true);
  });

  it("PODE ser o mesmo dia da semana, em outro horário (dona, 18/09)", () => {
    // Eu tinha travado isto achando que "2x na semana" exigia dias diferentes. Ela corrigiu: as
    // duas sessões podem cair no mesmo dia, desde que em horários diferentes.
    const segunda14h = new Date(2026, 8, 14, 14, 0);
    expect(segundoDiaValido("semanal2x", 1, "16:00", segunda14h)).toBe(true);
    expect(segundoDiaValido("semanal2x", 3, "16:00", segunda14h)).toBe(true);
  });

  it("o que não vale é repetir dia E horário — seria a mesma sessão duas vezes", () => {
    const segunda14h = new Date(2026, 8, 14, 14, 0);
    expect(segundoDiaValido("semanal2x", 1, "14:00", segunda14h)).toBe(false);
  });
});

describe("as datas geradas", () => {
  // Segunda, 14/09/2026, 14h → limite 07/10.
  const primeira = new Date(2026, 8, 14, 14, 0);
  const limite = new Date(2026, 9, 7, 23, 59, 59, 999);

  it("intercala os dois dias, na ordem do calendário — o exemplo do documento", () => {
    const datas = datasDaRepeticao({ primeira, limite, freq: "semanal2x", segundoDia: 3, segundoHorario: "16:00" });
    expect(datas.map(iso)).toEqual([
      "14/09 14h", "16/09 16h",
      "21/09 14h", "23/09 16h",
      "28/09 14h", "30/09 16h",
      "05/10 14h", "07/10 16h",
    ]);
  });

  it("são oito — o pacote de 2x por semana", () => {
    const datas = datasDaRepeticao({ primeira, limite, freq: "semanal2x", segundoDia: 3, segundoHorario: "16:00" });
    expect(datas).toHaveLength(8);
  });

  it("o segundo dia que cai ANTES do primeiro na semana começa na semana seguinte", () => {
    // Primeira numa quarta, segundo dia na segunda: a segunda desta semana já passou.
    const quarta = new Date(2026, 8, 16, 14, 0);
    const datas = datasDaRepeticao({
      primeira: quarta,
      limite: new Date(2026, 8, 30, 23, 59, 59, 999),
      freq: "semanal2x",
      segundoDia: 1,
      segundoHorario: "09:00",
    });
    expect(datas.map(iso)).toEqual(["16/09 14h", "21/09 09h", "23/09 14h", "28/09 09h", "30/09 14h"]);
  });

  it("duas no MESMO dia da semana: mesma data, horários diferentes", () => {
    // Segunda 14h + segunda 16h — o caso que ela liberou. São oito sessões em quatro semanas.
    const datas = datasDaRepeticao({
      primeira,
      limite: new Date(2026, 9, 5, 23, 59, 59, 999),
      freq: "semanal2x",
      segundoDia: 1,
      segundoHorario: "16:00",
    });
    expect(datas.map(iso)).toEqual([
      "14/09 14h", "14/09 16h",
      "21/09 14h", "21/09 16h",
      "28/09 14h", "28/09 16h",
      "05/10 14h", "05/10 16h",
    ]);
  });

  it("no mesmo dia, o segundo horário ANTES do primeiro também vale", () => {
    const datas = datasDaRepeticao({
      primeira,
      limite: new Date(2026, 8, 21, 23, 59, 59, 999),
      freq: "semanal2x",
      segundoDia: 1,
      segundoHorario: "09:00",
    });
    expect(datas.map(iso)).toEqual(["14/09 09h", "14/09 14h", "21/09 09h", "21/09 14h"]);
  });

  it("semanal comum continua um dia só", () => {
    const datas = datasDaRepeticao({ primeira, limite: new Date(2026, 8, 30, 23, 59), freq: "semanal" });
    expect(datas.map(iso)).toEqual(["14/09 14h", "21/09 14h", "28/09 14h"]);
  });

  it("quinzenal continua de duas em duas semanas", () => {
    const datas = datasDaRepeticao({ primeira, limite: new Date(2026, 9, 15, 23, 59), freq: "quinzenal" });
    expect(datas.map(iso)).toEqual(["14/09 14h", "28/09 14h", "12/10 14h"]);
  });
});
