import { describe, expect, it } from "vitest";
import { naoVieramNaSemana, semanaVigente } from "@/lib/naoVieramNaSemana";

const ativos = [{ id: "a" }, { id: "b" }, { id: "c" }];
// 2026-11-17 é uma terça-feira: a semana vai de domingo 15/11 a sábado 21/11.
const TERCA = "2026-11-17";

describe("semanaVigente", () => {
  it("devolve o domingo e o sábado da semana do dia", () => {
    expect(semanaVigente(TERCA)).toEqual({ domingo: "2026-11-15", sabado: "2026-11-21" });
  });

  it("no próprio domingo, a semana começa nele", () => {
    expect(semanaVigente("2026-11-15")).toEqual({ domingo: "2026-11-15", sabado: "2026-11-21" });
  });

  it("no sábado, a semana termina nele", () => {
    expect(semanaVigente("2026-11-21")).toEqual({ domingo: "2026-11-15", sabado: "2026-11-21" });
  });

  it("atravessa a virada do mês e do ano", () => {
    expect(semanaVigente("2027-01-01")).toEqual({ domingo: "2026-12-27", sabado: "2027-01-02" });
  });
});

describe("naoVieramNaSemana", () => {
  it("entra quem desmarcou, faltou ou teve atestado", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", status: "cancelada", date: "2026-11-16T09:00:00" },
        { patientId: "b", status: "nao_realizada", date: "2026-11-17T09:00:00" },
        { patientId: "c", status: "atestado", date: "2026-11-18T09:00:00" },
      ],
      TERCA,
    );
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("'realocada' é a outra forma de Desmarcou e também entra", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "b", status: "realocada", date: "2026-11-16T09:00:00" }], TERCA);
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("quem não tem nada marcado na semana NÃO entra (o 'status vazio' do pedido de 17/11)", () => {
    expect(naoVieramNaSemana(ativos, [], TERCA)).toEqual([]);
  });

  it("sessão agendada ou realizada não põe ninguém na lista", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", status: "agendada", date: "2026-11-18T09:00:00" },
        { patientId: "b", status: "realizada", date: "2026-11-16T09:00:00" },
        { patientId: "c", status: null, date: "2026-11-16T09:00:00" },
      ],
      TERCA,
    );
    expect(r).toEqual([]);
  });

  it("'prof_desmarcou' fica de fora: não foi o paciente que deixou de vir", () => {
    const r = naoVieramNaSemana(ativos, [{ patientId: "a", status: "prof_desmarcou", date: "2026-11-16T09:00:00" }], TERCA);
    expect(r).toEqual([]);
  });

  it("falta da semana PASSADA ou da que vem não conta", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", status: "nao_realizada", date: "2026-11-14T09:00:00" },
        { patientId: "b", status: "nao_realizada", date: "2026-11-22T09:00:00" },
      ],
      TERCA,
    );
    expect(r).toEqual([]);
  });

  it("o domingo e o sábado da semana entram", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", status: "atestado", date: "2026-11-15T09:00:00" },
        { patientId: "b", status: "cancelada", date: "2026-11-21T19:00:00" },
      ],
      TERCA,
    );
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("quem não está entre os ativos não aparece, mesmo tendo faltado", () => {
    const r = naoVieramNaSemana([{ id: "a" }], [{ patientId: "z", status: "nao_realizada", date: "2026-11-17T09:00:00" }], TERCA);
    expect(r).toEqual([]);
  });

  it("duas faltas da mesma pessoa não a duplicam", () => {
    const r = naoVieramNaSemana(
      ativos,
      [
        { patientId: "a", status: "cancelada", date: "2026-11-16T09:00:00" },
        { patientId: "a", status: "atestado", date: "2026-11-18T09:00:00" },
      ],
      TERCA,
    );
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });
});
