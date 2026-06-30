"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, ChevronDown } from "lucide-react";
import { formatBRL, patientStatusColor, paymentStatusColor, PAYMENT_STATUS_LABELS } from "@/lib/therapy";
import { MessagePatient } from "@/components/dashboard/MessagePatient";

type PatientCard = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  patientStatus: string;
  paymentStatus: string;
  sessionFee: string;
  frequency: string | null;
  paymentFormat: string | null;
  tags: string | null;
  attendanceDay: string | null;
  attendanceTime: string | null;
  balance: number;
  creditSessions: number;
  debtSessions: number;
};

const DAY_ORDER: Record<string, number> = { segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6, domingo: 7 };

function parseTags(t: string | null): string[] {
  return (t || "").split(",").map((x) => x.trim()).filter(Boolean);
}

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "ativo", label: "Ativos" },
  { key: "inativo", label: "Inativos" },
];
const WEEK_DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const FORMATS = [{ k: "avulso", l: "Avulso" }, { k: "mensal", l: "Mensal" }, { k: "quinzenal", l: "Quinzenal" }, { k: "pacote", l: "Pacote" }];

export function PatientsClient({ patients, initial }: { patients: PatientCard[]; initial?: { status?: string; tipo?: string; dia?: string; tag?: string } }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initial?.status || "todos");
  const [tag, setTag] = useState<string | null>(initial?.tag || null);
  const [day, setDay] = useState<string | null>(initial?.dia || null);
  const [fmt, setFmt] = useState<string | null>(initial?.tipo || null);
  const [sortHour, setSortHour] = useState(false);

  const allTags = Array.from(new Set(patients.flatMap((p) => parseTags(p.tags)))).sort();
  const norm = (d: string | null) => (d || "").toLowerCase().replace("terca", "terça").replace("sabado", "sábado");

  const filtered = patients.filter((p) => {
    const matchQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "todos" || p.patientStatus === filter;
    const matchTag = !tag || parseTags(p.tags).includes(tag);
    const matchDay = !day || norm(p.attendanceDay) === day;
    const matchFmt = !fmt || (p.paymentFormat || "avulso") === fmt;
    return matchQuery && matchFilter && matchTag && matchDay && matchFmt;
  });
  if (sortHour) {
    const key = (p: PatientCard) => `${p.attendanceTime || "99:99"}#${DAY_ORDER[p.attendanceDay || ""] ?? 9}`;
    filtered.sort((a, b) => key(a).localeCompare(key(b)));
  }

  const selCls = "appearance-none w-full pl-3.5 pr-8 py-2.5 rounded-full bg-white/70 border border-border text-sm font-medium text-foreground/70 hover:bg-white outline-none transition cursor-pointer capitalize";
  const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selCls}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
    </div>
  );

  const activeChips = [
    fmt && { label: FORMATS.find((f) => f.k === fmt)?.l, clear: () => setFmt(null) },
    day && { label: day, clear: () => setDay(null) },
    tag && { label: tag, clear: () => setTag(null) },
    sortHour && { label: "Por horário", clear: () => setSortHour(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full pl-12 pr-4 py-3 rounded-full bg-white/70 backdrop-blur border border-border outline-none transition"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex gap-2">
          <Sel value={filter} onChange={setFilter}>
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.key === "todos" ? "Status: todos" : f.label}</option>)}
          </Sel>
          <Sel value={fmt ?? "todos"} onChange={(v) => setFmt(v === "todos" ? null : v)}>
            <option value="todos">Tipo: todos</option>
            {FORMATS.map((f) => <option key={f.k} value={f.k}>{f.l}</option>)}
          </Sel>
          <Sel value={day ?? "todos"} onChange={(v) => setDay(v === "todos" ? null : v)}>
            <option value="todos">Dia: todos</option>
            {WEEK_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Sel>
          {allTags.length > 0 && (
            <Sel value={tag ?? "todas"} onChange={(v) => setTag(v === "todas" ? null : v)}>
              <option value="todas">Etiqueta: todas</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </Sel>
          )}
          <Sel value={sortHour ? "hora" : "alfa"} onChange={(v) => setSortHour(v === "hora")}>
            <option value="alfa">Ordem: A–Z</option>
            <option value="hora">Ordem: horário</option>
          </Sel>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center text-xs">
          <span className="text-foreground/40">Filtros:</span>
          {activeChips.map((c, i) => (
            <button key={i} onClick={c.clear} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container/30 text-primary font-semibold capitalize hover:bg-secondary-container/50 transition">
              {c.label} <span className="text-foreground/40">✕</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-foreground/40">Nenhum paciente encontrado.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="glass-card rounded-[24px] p-5 flex items-center gap-4 hover:shadow-lg transition-all group">
              <Link href={`/dashboard/patients/${p.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-lg shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold truncate">{p.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${patientStatusColor(p.patientStatus)}`}>
                      {p.patientStatus}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/30 text-primary">
                      {FORMATS.find((f) => f.k === (p.paymentFormat || "avulso"))?.l ?? "Avulso"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/50 truncate">{formatBRL(p.sessionFee)}/sessão{(p.attendanceDay || p.attendanceTime) ? <span className="text-foreground/40"> · 🕐 <span className="capitalize">{p.attendanceDay || ""}</span> {p.attendanceTime || ""}</span> : null}</p>
                  <div className="mt-1">
                    {p.balance < 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#b91c1c]">⚠️ Devendo {p.debtSessions} sessão(ões)</span>
                    ) : p.creditSessions > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857]">💳 {p.creditSessions} sessão(ões) de crédito</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface text-foreground/50">Em dia</span>
                    )}
                  </div>
                  {parseTags(p.tags).length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {parseTags(p.tags).map((t) => (
                        <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/30 text-primary">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
              <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-full ${paymentStatusColor(p.paymentStatus)}`}>
                {PAYMENT_STATUS_LABELS[p.paymentStatus]}
              </span>
              <MessagePatient patient={{ id: p.id, name: p.name, phone: p.phone, email: p.email }} />
              <Link href={`/dashboard/patients/${p.id}`} className="hidden sm:block">
                <ChevronRight className="w-5 h-5 text-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
