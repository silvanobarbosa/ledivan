import { describe, it, expect } from "vitest";
import { monthlyReport, receivedByMonth } from "@/lib/pagamentos";

describe("monthlyReport", () => {
  const sessions = [
    { patientId: "a", ym: "2026-09", fee: 200, chargeable: true, status: "realizada" },
    { patientId: "a", ym: "2026-09", fee: 200, chargeable: true, status: "agendada" }, // reserva futura conta
    { patientId: "b", ym: "2026-09", fee: 150, chargeable: true, status: "realizada" },
    { patientId: "a", ym: "2026-09", fee: 200, chargeable: true, status: "cancelada" }, // não conta
    { patientId: "a", ym: "2026-10", fee: 200, chargeable: false, status: "realizada" }, // não cobrável
  ];
  const payments = [
    { patientId: "a", ym: "2026-09", amount: 200, kind: null },
    { patientId: "b", ym: "2026-09", amount: 150, kind: null },
    { patientId: "a", ym: "2026-09", amount: 999, kind: "pacote" }, // crédito de pacote não conta
  ];

  it("esperado ignora cancelada/não-cobrável; futura (agendada) conta", () => {
    const r = monthlyReport(2026, sessions, payments);
    const set = r.totals[8]; // setembro (idx 8)
    expect(set.esperado).toBe(200 + 200 + 150); // a: 2 sessões + b: 1
    expect(set.pago).toBe(200 + 150);           // crédito de pacote fora
    expect(set.aberto).toBe(200);
  });

  it("detalhe por paciente do mês", () => {
    const r = monthlyReport(2026, sessions, payments);
    const det = r.patientsOfMonth(8).sort((x, y) => x.patientId.localeCompare(y.patientId));
    expect(det[0]).toEqual({ patientId: "a", esperado: 400, pago: 200, aberto: 200 });
    expect(det[1]).toEqual({ patientId: "b", esperado: 150, pago: 150, aberto: 0 });
  });

  it("12 meses no ano", () => {
    const r = monthlyReport(2026, [], []);
    expect(r.months.length).toBe(12);
    expect(r.months[0]).toBe("2026-01");
  });
});

describe("receivedByMonth", () => {
  it("soma recebido por mês de um paciente (sem crédito de pacote)", () => {
    const out = receivedByMonth(2026, "a", [
      { patientId: "a", ym: "2026-03", amount: 100, kind: null },
      { patientId: "a", ym: "2026-03", amount: 50, kind: null },
      { patientId: "a", ym: "2026-05", amount: 200, kind: null },
      { patientId: "a", ym: "2026-05", amount: 999, kind: "pacote" },
      { patientId: "b", ym: "2026-03", amount: 300, kind: null },
    ]);
    expect(out[2]).toBe(150); // março
    expect(out[4]).toBe(200); // maio (pacote fora)
    expect(out[0]).toBe(0);
  });
});
