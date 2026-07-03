"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

const PERIODS = [{ k: "1m", l: "Mês" }, { k: "6m", l: "6 meses" }, { k: "12m", l: "12 meses" }, { k: "all", l: "Tudo" }];

export function AnalyticsFilters({ patients, activePeriod, patient, from, to }: {
  patients: { id: string; name: string }[];
  activePeriod: string; patient?: string; from?: string; to?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const nav = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") q.delete(k); else q.set(k, v); }
    router.push(`/dashboard?${q.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <select value={patient || ""} onChange={(e) => nav({ patient: e.target.value || null })}
          className="appearance-none pl-3.5 pr-8 py-2 rounded-full bg-white/70 border border-border text-sm font-medium text-foreground/70 hover:bg-white outline-none transition cursor-pointer max-w-[180px] truncate">
          <option value="">Todos os pacientes</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
      </div>
      {PERIODS.map((p) => (
        <button key={p.k} onClick={() => nav({ period: p.k, from: null, to: null })}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activePeriod === p.k ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"}`}>{p.l}</button>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); nav({ period: "custom", from: (fd.get("from") as string) || null, to: (fd.get("to") as string) || null }); }} className="flex items-center gap-1.5 rounded-full bg-white/60 px-2 py-1">
        <input type="date" name="from" defaultValue={from || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
        <span className="text-xs text-foreground/40">→</span>
        <input type="date" name="to" defaultValue={to || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
        <button className={`px-3 py-1 rounded-full text-xs font-bold transition ${activePeriod === "custom" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>Aplicar</button>
      </form>
    </div>
  );
}
