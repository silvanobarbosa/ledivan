import { describe, expect, it } from "vitest";
import { naoVieramNaSemana } from "@/lib/naoVieramNaSemana";

const ativos = [{ id: "a" }, { id: "b" }, { id: "c" }];
const CORTE = "2026-11-09";
const HOJE = "2026-11-15";

describe("naoVieramNaSemana", () => {
  it("tira da lista quem teve sessão realizada dentro da janela", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "a", presente: true, date: "2026-11-10T09:00:00" }], CORTE, HOJE);
    expect(r.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("sessão da PRÓXIMA semana não conta como comparecimento (doc 74)", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "a", presente: true, date: "2026-11-17T09:00:00" }], CORTE, HOJE);
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("sessão de hoje conta; sessão anterior ao corte não", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", presente: true, date: "2026-11-15T20:00:00" },
        { patientId: "b", presente: true, date: "2026-11-08T09:00:00" },
      ],
      CORTE,
      HOJE,
    );
    expect(r.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("falta (presente=false) não tira ninguém da lista", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "a", presente: false, date: "2026-11-10T09:00:00" }], CORTE, HOJE);
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("o dia do corte é inclusive", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "c", presente: true, date: "2026-11-09T23:00:00" }], CORTE, HOJE);
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
