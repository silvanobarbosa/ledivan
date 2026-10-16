import { describe, it, expect } from "vitest";
import { sessoesDaSerieARemover, podeReplanejar } from "@/lib/replanejarRecorrencia";

const d = (iso: string) => new Date(iso);
const UNTIL = "2026-12-31T23:59:59.999Z";

function sess(over: Partial<Parameters<typeof sessoesDaSerieARemover>[0]["existentes"][number]> & { id: string; data: string }) {
  return { status: "agendada", recurring: true, pago: false, recurrenceFreq: "semanal", recurrenceUntil: UNTIL, ...over, data: over.data };
}

describe("sessoesDaSerieARemover (doc 43)", () => {
  const anchor = { data: "2026-10-20T15:00:00.000Z", recurrenceFreq: "semanal", recurrenceUntil: UNTIL };

  it("remove as futuras da série (agendada, recorrente, sem pagamento), inclusive o anchor", () => {
    const existentes = [
      sess({ id: "a", data: "2026-10-20T15:00:00.000Z" }), // anchor
      sess({ id: "b", data: "2026-10-27T15:00:00.000Z" }),
      sess({ id: "c", data: "2026-11-03T15:00:00.000Z" }),
    ];
    expect(sessoesDaSerieARemover({ anchor, existentes })).toEqual(["a", "b", "c"]);
  });

  it("preserva passado, realizada, falta, cancelada e paga", () => {
    const existentes = [
      sess({ id: "passado", data: "2026-10-13T15:00:00.000Z" }), // antes do anchor
      sess({ id: "realizada", data: "2026-10-27T15:00:00.000Z", status: "realizada" }),
      sess({ id: "falta", data: "2026-11-03T15:00:00.000Z", status: "nao_realizada" }),
      sess({ id: "cancelada", data: "2026-11-10T15:00:00.000Z", status: "cancelada" }),
      sess({ id: "paga", data: "2026-11-17T15:00:00.000Z", pago: true }),
      sess({ id: "ok", data: "2026-11-24T15:00:00.000Z" }),
    ];
    expect(sessoesDaSerieARemover({ anchor, existentes })).toEqual(["ok"]);
  });

  it("não toca em encaixe avulso (recurring=false) nem em outra série (limite diferente)", () => {
    const existentes = [
      sess({ id: "avulso", data: "2026-10-22T10:00:00.000Z", recurring: false }),
      sess({ id: "outraSerie", data: "2026-10-27T09:00:00.000Z", recurrenceUntil: "2027-06-30T23:59:59.999Z" }),
      sess({ id: "mesmaSerie", data: "2026-10-27T15:00:00.000Z" }),
    ];
    expect(sessoesDaSerieARemover({ anchor, existentes })).toEqual(["mesmaSerie"]);
  });

  it("ignora série de outra frequência", () => {
    const existentes = [
      sess({ id: "quinzenal", data: "2026-10-27T15:00:00.000Z", recurrenceFreq: "quinzenal" }),
      sess({ id: "semanal", data: "2026-11-03T15:00:00.000Z" }),
    ];
    expect(sessoesDaSerieARemover({ anchor, existentes })).toEqual(["semanal"]);
  });
});

describe("podeReplanejar", () => {
  it("só sessão futura recorrente, agendada e não paga", () => {
    expect(podeReplanejar({ status: "agendada", recurring: true, pago: false })).toBe(true);
    expect(podeReplanejar({ status: "realizada", recurring: true, pago: false })).toBe(false);
    expect(podeReplanejar({ status: "agendada", recurring: false, pago: false })).toBe(false);
    expect(podeReplanejar({ status: "agendada", recurring: true, pago: true })).toBe(false);
  });
});
