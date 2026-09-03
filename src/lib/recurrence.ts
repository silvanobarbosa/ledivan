// Cálculo das datas de uma reserva de agenda recorrente. Puro (sem DB) — testável.

export type LockFreq = "semanal" | "quinzenal" | "mensal";

const DOW: Record<string, number> = { domingo: 0, "segunda-feira": 1, terca: 2, "terça-feira": 2, quarta: 3, "quarta-feira": 3, quinta: 4, "quinta-feira": 4, sexta: 5, "sexta-feira": 5, sabado: 6, "sábado": 6, segunda: 1, terça: 2 };

export type LockSpec = {
  weekday: number;        // 0..6
  hour: number; minute: number;
  start: Date;
  end: Date;
  freq: LockFreq;
  maxCount?: number;      // teto de segurança (default 260 ~ 5 anos semanal)
};

export function weekdayIndex(day: string | null | undefined): number | undefined {
  if (!day) return undefined;
  const k = day.toLowerCase().trim();
  return DOW[k];
}

// Calcula o fim a partir de uma duração (X meses/anos) desde o início.
export function endFromDuration(start: Date, value: number, unit: "meses" | "anos"): Date {
  const v = Math.max(1, Math.min(5, Math.floor(value) || 1));
  const end = new Date(start);
  if (unit === "anos") end.setFullYear(end.getFullYear() + v);
  else end.setMonth(end.getMonth() + v);
  return end;
}

function advance(d: Date, freq: LockFreq): void {
  if (freq === "mensal") d.setMonth(d.getMonth() + 1);
  else if (freq === "quinzenal") d.setDate(d.getDate() + 14);
  else d.setDate(d.getDate() + 7);
}

// Gera EXATAMENTE `count` ocorrências a partir de start, no dia da semana e frequência dados.
// Usado pela reserva de PACOTE (N sessões fixas), independente de data-fim.
export function occurrencesByCount(
  weekday: number, hour: number, minute: number, start: Date, freq: LockFreq, count: number,
): Date[] {
  const cur = new Date(start); cur.setHours(0, 0, 0, 0);
  while (cur.getDay() !== weekday) cur.setDate(cur.getDate() + 1);
  const out: Date[] = [];
  const n = Math.max(0, Math.min(60, Math.floor(count)));
  for (let i = 0; i < n; i++) {
    const d = new Date(cur); d.setHours(hour, minute, 0, 0);
    out.push(d);
    if (freq === "mensal") cur.setMonth(cur.getMonth() + 1);
    else if (freq === "quinzenal") cur.setDate(cur.getDate() + 14);
    else cur.setDate(cur.getDate() + 7);
  }
  return out;
}

// Gera as datas (com hora) das ocorrências entre start e end, no dia da semana e frequência dados.
export function occurrences(spec: LockSpec): Date[] {
  const { weekday, hour, minute, start, end, freq } = spec;
  const cap = spec.maxCount ?? 260;
  const cur = new Date(start); cur.setHours(0, 0, 0, 0);
  while (cur.getDay() !== weekday) cur.setDate(cur.getDate() + 1);
  const out: Date[] = [];
  let guard = 0;
  while (cur <= end && guard++ < cap) {
    const d = new Date(cur); d.setHours(hour, minute, 0, 0);
    out.push(d);
    advance(cur, freq);
  }
  return out;
}
