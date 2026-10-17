/**
 * Recorrência mensal de um lançamento (doc 47): a partir de uma data-base (YYYY-MM-DD), gera N datas,
 * uma por mês, mantendo o dia do mês e grudando no último dia quando o mês de destino não o tem
 * (31/jan → 28/fev). Pura — a regra de calendário fica longe do banco e pode ser conferida sozinha.
 */

/** Último dia do mês (1–12) de um ano, respeitando ano bissexto. */
function ultimoDiaDoMes(ano: number, mes1a12: number): number {
  return new Date(ano, mes1a12, 0).getDate();
}

/**
 * As datas de um lançamento repetido mensalmente. `meses` é o total de ocorrências (inclui a 1ª);
 * < 1 vira 1 (só a própria data). Nunca passa por fuso: trabalha só com ano/mês/dia.
 */
export function datasRecorrentes(baseISO: string, meses: number): string[] {
  const m = baseISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return [];
  const ano = Number(m[1]);
  const mes = Number(m[2]); // 1–12
  const dia = Number(m[3]);
  const total = Math.max(1, Math.floor(meses) || 1);

  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    const alvoIdx = mes - 1 + i; // índice 0-based acumulado
    const anoAlvo = ano + Math.floor(alvoIdx / 12);
    const mesAlvo = (alvoIdx % 12) + 1; // 1–12
    const diaAlvo = Math.min(dia, ultimoDiaDoMes(anoAlvo, mesAlvo));
    out.push(`${anoAlvo}-${String(mesAlvo).padStart(2, "0")}-${String(diaAlvo).padStart(2, "0")}`);
  }
  return out;
}
