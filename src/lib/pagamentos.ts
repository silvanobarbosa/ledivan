// Relatório de pagamentos por mês. Puro (sem DB) — testável.
// Esperado do mês = sessões cobráveis do mês × fee (futuras = reservas/agendadas contam).
// Pago = pagamentos recebidos no mês (kind != pacote). Em aberto = max(0, esperado − pago).

export type PgSession = { patientId: string; ym: string; fee: number; chargeable: boolean; status: string };
export type PgPayment = { patientId: string; ym: string; amount: number; kind: string | null };

const OUT = new Set(["cancelada", "realocada", "nao_realizada"]); // não geram esperado

export type MonthCell = { esperado: number; pago: number; aberto: number };
export type PatientMonth = { patientId: string; esperado: number; pago: number; aberto: number };

// Matriz por mês (12) para o ano dado: total geral + detalhe por paciente.
export function monthlyReport(year: number, sessions: PgSession[], payments: PgPayment[]) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const mIdx = new Map(months.map((m, i) => [m, i]));

  // esperado[mês][paciente], pago[mês][paciente]
  const esperado: Map<string, number>[] = months.map(() => new Map());
  const pago: Map<string, number>[] = months.map(() => new Map());

  for (const s of sessions) {
    const i = mIdx.get(s.ym);
    if (i === undefined || !s.chargeable || OUT.has(s.status)) continue;
    esperado[i].set(s.patientId, (esperado[i].get(s.patientId) ?? 0) + s.fee);
  }
  for (const p of payments) {
    const i = mIdx.get(p.ym);
    if (i === undefined || p.kind === "pacote") continue;
    pago[i].set(p.patientId, (pago[i].get(p.patientId) ?? 0) + p.amount);
  }

  const totals: MonthCell[] = months.map((_, i) => {
    let e = 0, pg = 0;
    for (const v of esperado[i].values()) e += v;
    for (const v of pago[i].values()) pg += v;
    return { esperado: e, pago: pg, aberto: Math.max(0, e - pg) };
  });

  // detalhe por paciente de um mês
  const patientsOfMonth = (i: number): PatientMonth[] => {
    const ids = new Set<string>([...esperado[i].keys(), ...pago[i].keys()]);
    return [...ids].map((pid) => {
      const e = esperado[i].get(pid) ?? 0, pg = pago[i].get(pid) ?? 0;
      return { patientId: pid, esperado: e, pago: pg, aberto: Math.max(0, e - pg) };
    });
  };

  return { months, totals, patientsOfMonth };
}

// Recebido por mês de UM paciente (quadro 1).
export function receivedByMonth(year: number, patientId: string, payments: PgPayment[]): number[] {
  const out = Array(12).fill(0);
  for (const p of payments) {
    if (p.patientId !== patientId || p.kind === "pacote") continue;
    const [y, m] = p.ym.split("-").map(Number);
    if (y === year && m >= 1 && m <= 12) out[m - 1] += p.amount;
  }
  return out;
}
