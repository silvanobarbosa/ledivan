"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X, Search, Plus, MapPin } from "lucide-react";
import { saveHolidayCities } from "@/app/dashboard/agenda/holiday-actions";
import type { HolidayCity } from "@/lib/holidays-style";

export function HolidaySetup({ cities, autoOpen = false }: { cities: HolidayCity[]; autoOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [selected, setSelected] = useState<HolidayCity[]>(cities);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HolidayCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) { setResults([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/holidays/cities?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(j.cities ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q, open]);

  const has = (c: HolidayCity) => selected.some((s) => s.ibge === c.ibge);
  const add = (c: HolidayCity) => { if (selected.length < 3 && !has(c)) setSelected([...selected, c]); setQ(""); setResults([]); };
  const remove = (ibge: number) => setSelected(selected.filter((s) => s.ibge !== ibge));

  const save = () => startTransition(async () => {
    await saveHolidayCities(selected);
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      {cities.length === 0 ? (
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 glass-card rounded-2xl px-4 py-3 text-left hover:scale-[1.005] transition">
          <span className="w-10 h-10 rounded-xl bg-[#cffafe] text-[#0e7490] flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-primary">Ativar feriados na agenda</span>
            <span className="block text-xs text-foreground/50">Escolha até 3 cidades — os feriados aparecem destacados por cor.</span>
          </span>
          <Plus className="w-5 h-5 text-primary ml-auto shrink-0" />
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50"><CalendarDays className="w-4 h-4 text-[#0e7490]" /> Feriados:</span>
          {cities.map((c) => (
            <span key={c.ibge} className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-1">
              <MapPin className="w-3 h-3" /> {c.nome}{c.uf ? `/${c.uf}` : ""}
            </span>
          ))}
          <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary hover:underline ml-1">editar</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[28px] p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-display font-bold text-primary">Feriados na agenda</p>
                <p className="text-xs text-foreground/50">Escolha até 3 cidades. Mostramos feriados nacionais, estaduais, municipais e pontos facultativos.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map((c) => (
                  <span key={c.ibge} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-full pl-3 pr-1.5 py-1.5">
                    {c.nome}{c.uf ? `/${c.uf}` : ""}
                    <button onClick={() => remove(c.ibge)} className="w-4 h-4 rounded-full bg-primary/15 hover:bg-primary/30 flex items-center justify-center"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            {selected.length < 3 && (
              <div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface border border-border">
                  <Search className="w-4 h-4 text-foreground/40 shrink-0" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cidade…" className="w-full bg-transparent outline-none text-sm" />
                </div>
                {(loading || results.length > 0) && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {loading && <p className="px-3 py-2 text-xs text-foreground/40">Buscando…</p>}
                    {results.map((c) => (
                      <button key={c.ibge} disabled={has(c)} onClick={() => add(c)} className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface disabled:opacity-40 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-foreground/40 shrink-0" />
                        <span className="truncate">{c.nome}</span>
                        <span className="ml-auto text-xs font-semibold text-foreground/40">{c.uf}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button disabled={pending} onClick={save} className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                {pending ? "Salvando…" : selected.length ? "Salvar cidades" : "Desativar feriados"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
