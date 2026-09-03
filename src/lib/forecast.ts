// Previsão de receita futura, em 4 baldes SEPARADOS e não sobrepostos (somam sem dupla contagem):
//  1. agendado    — sessões futuras já marcadas (avulsas/recorrentes materializadas), sem pacote.
//  2. pacotes     — sessões futuras marcadas que pertencem a um pacote (dinheiro a receber do pacote).
//  3. recorrencia — projeção do que a recorrência do paciente ESPERA além do que já está marcado (gap).
//  4. reajuste    — acréscimo por reajustes de preço com data efetiva futura.
// Tudo por mês, com subtotal de cada balde e total geral.

export const PERIODO_MES: Record<string, number> = { semanal: 4, quinzenal: 2, mensal: 1 };

export type FSession = { ym: string; fee: number; packageId: string | null; patientId: string };
export type FRecurring = { patientId: string; fee: number; perMonth: number };
export type FPriceChange = { patientId: string; ym: string; newFee: number; oldFee: number };

export type MonthRow = { ym: string; label: string; agendado: number; pacotes: number; recorrencia: number; reajuste: number; total: number };
export type Forecast = {
  months: MonthRow[];
  subtotals: { agendado: number; pacotes: number; recorrencia: number; reajuste: number; total: number };
};

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthKeys(baseYear: number, baseMonth0: number, horizon: number): { ym: string; label: string }[] {
  const out: { ym: string; label: string }[] = [];
  for (let i = 0; i < horizon; i++) {
    const y = baseYear + Math.floor((baseMonth0 + i) / 12);
    const m = (baseMonth0 + i) % 12;
    out.push({ ym: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MONTH_ABBR[m]}/${String(y).slice(2)}` });
  }
  return out;
}

export function buildForecast(
  keys: { ym: string; label: string }[],
  sessions: FSession[],
  recurring: FRecurring[],
  priceChanges: FPriceChange[],
): Forecast {
  const idx = new Map(keys.map((k, i) => [k.ym, i]));
  const rows: MonthRow[] = keys.map((k) => ({ ym: k.ym, label: k.label, agendado: 0, pacotes: 0, recorrencia: 0, reajuste: 0, total: 0 }));

  // contagem de sessões avulsas marcadas por paciente/mês (base do gap da recorrência)
  const bookedCount: Map<string, number[]> = new Map(); // patientId -> [count por mês]
  const ensure = (pid: string) => { if (!bookedCount.has(pid)) bookedCount.set(pid, keys.map(() => 0)); return bookedCount.get(pid)!; };

  for (const s of sessions) {
    const i = idx.get(s.ym);
    if (i === undefined) continue;
    if (s.packageId) rows[i].pacotes += s.fee;
    else { rows[i].agendado += s.fee; ensure(s.patientId)[i] += 1; }
  }

  // 3. recorrência esperada além do marcado (gap = max(0, esperado/mês − marcado)) × fee
  for (const r of recurring) {
    const booked = bookedCount.get(r.patientId);
    for (let i = 0; i < keys.length; i++) {
      const gap = Math.max(0, r.perMonth - (booked?.[i] ?? 0));
      rows[i].recorrencia += gap * r.fee;
    }
  }

  // 4. reajustes: a partir do mês efetivo, delta × sessões esperadas/mês do paciente
  const perMonthOf = new Map(recurring.map((r) => [r.patientId, r.perMonth]));
  for (const pc of priceChanges) {
    const start = idx.get(pc.ym);
    if (start === undefined) continue;
    const delta = pc.newFee - pc.oldFee;
    if (delta === 0) continue;
    const pm = perMonthOf.get(pc.patientId) ?? 0;
    for (let i = start; i < keys.length; i++) rows[i].reajuste += delta * pm;
  }

  const subtotals = { agendado: 0, pacotes: 0, recorrencia: 0, reajuste: 0, total: 0 };
  for (const row of rows) {
    row.total = row.agendado + row.pacotes + row.recorrencia + row.reajuste;
    subtotals.agendado += row.agendado;
    subtotals.pacotes += row.pacotes;
    subtotals.recorrencia += row.recorrencia;
    subtotals.reajuste += row.reajuste;
    subtotals.total += row.total;
  }
  return { months: rows, subtotals };
}
