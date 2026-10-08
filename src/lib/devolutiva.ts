/**
 * PRÓXIMAS DEVOLUTIVAS (doc 9, item 2) — função pura.
 *
 * A devolutiva não vira repetição na agenda (geraria conflito de horário e ignora a disponibilidade).
 * Em vez disso, o Dashboard mostra o paciente quando falta 1 semana para a próxima devolutiva prevista:
 *   - primeira devolutiva = data da 1ª sessão + "Devolutiva a cada X meses";
 *   - próximas = a partir do ÚLTIMO agendamento tipo devolutiva + o mesmo intervalo.
 * O botão ✓ "dispensa" a devolutiva deste ciclo (resolve sem agendar); ela volta no ciclo seguinte.
 */

/** A próxima devolutiva prevista. `null` quando não há intervalo ou base (nenhuma sessão ainda). */
export function proximaDevolutiva(
  primeiraSessao: Date | null,
  ultimaDevolutiva: Date | null,
  meses: number | null | undefined,
): Date | null {
  if (!meses || meses <= 0) return null;
  const base = ultimaDevolutiva ?? primeiraSessao;
  if (!base) return null;
  const d = new Date(base);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // Mês mais curto: cai no último dia dele (31/01 + 1 mês = 28/02), como o reajuste faz.
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

/** Dias até a próxima devolutiva (negativo = já passou). */
export function diasParaDevolutiva(proxima: Date | null, hoje: Date = new Date()): number | null {
  if (!proxima) return null;
  const dia = 24 * 60 * 60 * 1000;
  const a = Date.UTC(proxima.getFullYear(), proxima.getMonth(), proxima.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / dia);
}

/**
 * Entra na lista? Só quando falta ≤ 7 dias (inclui vencida) E não foi dispensada NESTE ciclo. A
 * dispensa guarda a data da própria devolutiva; se a próxima avançou (ciclo novo), ela reaparece.
 */
export function devolutivaNaLista(
  proxima: Date | null,
  dispensadaEm: Date | null | undefined,
  hoje: Date = new Date(),
): boolean {
  if (!proxima) return false;
  const dias = diasParaDevolutiva(proxima, hoje);
  if (dias == null || dias > 7) return false;
  if (dispensadaEm && dispensadaEm.getTime() >= proxima.getTime()) return false;
  return true;
}
