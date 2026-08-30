// Feriados na agenda (server). Fonte: feriadosapi.com (nacional/estadual/municipal/facultativo
// por código IBGE). Uma chamada por cidade+ano, com CACHE em holiday_cache (respeita a cota).
// Token em FERIADOS_API_TOKEN (env). Sem token → degrada pra vazio (feriados somem, app segue).
import { db } from "@/db";
import { holidayCache } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { HOLIDAY_PRIORITY, type Holiday, type HolidayCity, type HolidayType } from "@/lib/holidays-style";

export type { Holiday, HolidayCity, HolidayType } from "@/lib/holidays-style";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** Parseia o JSON de holidayCities do usuário. Retorna [] se vazio/inválido. */
export function parseHolidayCities(json: string | null | undefined): HolidayCity[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter((c) => c && typeof c.ibge === "number" && c.nome).slice(0, 3);
  } catch { return []; }
}

const brToISO = (ddmmyyyy: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Busca feriados de UMA cidade num ano direto na API (sem cache). Sem token → []. */
async function fetchCity(ibge: number, year: number): Promise<Holiday[]> {
  const token = process.env.FERIADOS_API_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(`https://feriadosapi.com/api/v1/feriados/cidade/${ibge}?ano=${year}&facultativos=true&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { feriados?: { data: string; nome: string; tipo: string }[] };
    const out: Holiday[] = [];
    for (const f of j.feriados ?? []) {
      const date = brToISO(f.data);
      const tipo = (f.tipo || "").toUpperCase() as HolidayType;
      if (date && tipo in HOLIDAY_PRIORITY) out.push({ date, nome: f.nome, tipo });
    }
    return out;
  } catch { return []; }
}

/** Feriados de uma cidade+ano com read-through no cache (holiday_cache). */
async function cityHolidaysCached(ibge: number, year: number): Promise<Holiday[]> {
  const [row] = await db.select().from(holidayCache)
    .where(and(eq(holidayCache.cityIbge, ibge), eq(holidayCache.year, year))).limit(1);
  if (row) { try { return JSON.parse(row.data) as Holiday[]; } catch { return []; } }
  const fresh = await fetchCity(ibge, year);
  if (fresh.length) {
    await db.insert(holidayCache).values({ cityIbge: ibge, year, data: JSON.stringify(fresh) })
      .onConflictDoNothing().catch(() => {});
  }
  return fresh;
}

/**
 * Feriados das cidades do usuário nos anos pedidos, mesclados e deduplicados.
 * Dedup por data+nome-normalizado, mantendo o de MAIOR nível (Nacional>Estadual>Municipal>Facultativo).
 * Municipais ganham `cityName` quando há mais de uma cidade (pra distinguir na legenda).
 * Retorna Map<YYYY-MM-DD, Holiday[]>.
 */
export async function holidaysByDate(cities: HolidayCity[], years: number[]): Promise<Map<string, Holiday[]>> {
  const map = new Map<string, Holiday[]>();
  if (!cities.length || !years.length) return map;
  const multi = cities.length > 1;
  const seen = new Map<string, Holiday>();

  for (const city of cities) {
    for (const year of years) {
      const hs = await cityHolidaysCached(city.ibge, year);
      for (const h of hs) {
        const tagged: Holiday = h.tipo === "MUNICIPAL" && multi ? { ...h, cityName: city.nome } : { ...h };
        const key = `${h.date}|${norm(h.nome)}`;
        const prev = seen.get(key);
        if (!prev || HOLIDAY_PRIORITY[tagged.tipo] < HOLIDAY_PRIORITY[prev.tipo]) seen.set(key, tagged);
      }
    }
  }
  for (const h of seen.values()) {
    const arr = map.get(h.date) ?? [];
    arr.push(h);
    map.set(h.date, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => HOLIDAY_PRIORITY[a.tipo] - HOLIDAY_PRIORITY[b.tipo]);
  return map;
}
