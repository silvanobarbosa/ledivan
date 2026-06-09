"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, ChevronRight, Search, ChevronDown } from "lucide-react";
import { formatBRL } from "@/lib/therapy";

type Row = { id: string; name: string; balance: number; sessions: number; paymentFormat: string | null; attendanceDay: string | null; attendanceTime: string | null; tags: string | null };

const FORMATS = [{ k: "avulso", l: "Avulso" }, { k: "mensal", l: "Mensal" }, { k: "quinzenal", l: "Quinzenal" }, { k: "pacote", l: "Pacote" }];
const WEEK_DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const parseTags = (t: string | null) => (t || "").split(",").map((x) => x.trim()).filter(Boolean);
const norm = (d: string | null) => (d || "").toLowerCase().replace("terca", "terça").replace("sabado", "sábado");

export function CreditosClient({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [fmt, setFmt] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [order, setOrder] = useState("neg"); // neg = mais negativos primeiro; pos = mais positivos

  const allTags = Array.from(new Set(rows.flatMap((r) => parseTags(r.tags)))).sort();

  const filtered = rows.filter((r) => {
    const mQ = r.name.toLowerCase().includes(query.toLowerCase());
    const mF = !fmt || (r.paymentFormat || "avulso") === fmt;
    const mD = !day || norm(r.attendanceDay) === day;
    const mT = !tag || parseTags(r.tags).includes(tag);
    return mQ && mF && mD && mT;
  }).sort((a, b) => order === "pos" ? b.sessions - a.sessions : a.sessions - b.sessions);

  const selCls = "appearance-none w-full pl-3.5 pr-8 py-2.5 rounded-full bg-white/70 border border-border text-sm font-medium text-foreground/70 hover:bg-white outline-none transition cursor-pointer capitalize";
  const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Gestão de Créditos
        </h1>
        <p className="text-foreground/50 mt-1">Pacientes ativos por saldo de sessões.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar paciente..." className="w-full pl-12 pr-4 py-3 rounded-full bg-white/70 backdrop-blur border border-border outline-none transition" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Sel value={fmt ?? "todos"} onChange={(v) => setFmt(v === "todos" ? null : v)}>
            <option value="todos">Tipo: todos</option>
            {FORMATS.map((f) => <option key={f.k} value={f.k}>{f.l}</option>)}
          </Sel>
          <Sel value={day ?? "todos"} onChange={(v) => setDay(v === "todos" ? null : v)}>
            <option value="todos">Dia: todos</option>
            {WEEK_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Sel>
          {allTags.length > 0 ? (
            <Sel value={tag ?? "todas"} onChange={(v) => setTag(v === "todas" ? null : v)}>
              <option value="todas">Etiqueta: todas</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Sel>
          ) : <div className="hidden sm:block" />}
          <Sel value={order} onChange={setOrder}>
            <option value="neg">↑ Mais negativos</option>
            <option value="pos">↓ Mais positivos</option>
          </Sel>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhum paciente encontrado.</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => {
            const credit = Math.floor(r.sessions);
            const negative = r.balance < 0;
            const debt = negative ? Math.ceil(-r.sessions) : 0;
            return (
              <Link key={r.id} href={`/dashboard/patients/${r.id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition group">
                <span className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-display font-bold shrink-0 ${negative ? "bg-[#fef2f2] text-[#b91c1c]" : credit > 0 ? "bg-[#ecfdf5] text-[#047857]" : "bg-surface text-foreground/50"}`}>
                  <span className="text-base leading-none">{negative ? `-${debt}` : credit}</span>
                  <span className="text-[8px] uppercase">sess.</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{r.name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/30 text-primary">{FORMATS.find((f) => f.k === (r.paymentFormat || "avulso"))?.l ?? "Avulso"}</span>
                  </div>
                  <p className="text-sm text-foreground/50">
                    {negative ? <span className="text-[#b91c1c] font-semibold">Devendo {formatBRL(Math.abs(r.balance).toFixed(2))}</span> : <span className="text-[#047857] font-semibold">Crédito {formatBRL(r.balance.toFixed(2))}</span>}
                    {(r.attendanceDay || r.attendanceTime) ? <span className="text-foreground/40"> · 🕐 <span className="capitalize">{r.attendanceDay || ""}</span> {r.attendanceTime || ""}</span> : null}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
