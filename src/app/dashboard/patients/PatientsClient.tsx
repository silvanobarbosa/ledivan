"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
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
  { key: "pausado", label: "Pausados" },
  { key: "inativo", label: "Inativos" },
];

export function PatientsClient({ patients }: { patients: PatientCard[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [tag, setTag] = useState<string | null>(null);
  const [sortHour, setSortHour] = useState(false);

  const allTags = Array.from(new Set(patients.flatMap((p) => parseTags(p.tags)))).sort();

  const filtered = patients.filter((p) => {
    const matchQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "todos" || p.patientStatus === filter;
    const matchTag = !tag || parseTags(p.tags).includes(tag);
    return matchQuery && matchFilter && matchTag;
  });
  if (sortHour) {
    const key = (p: PatientCard) => `${p.attendanceTime || "99:99"}#${DAY_ORDER[p.attendanceDay || ""] ?? 9}`;
    filtered.sort((a, b) => key(a).localeCompare(key(b)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/70 backdrop-blur border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                filter === f.key ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setSortHour((s) => !s)}
            title="Ordenar por hora de atendimento"
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${sortHour ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"}`}
          >
            🕐 {sortHour ? "Por horário" : "Horário"}
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTag(null)} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${!tag ? "bg-primary text-white" : "bg-white/60 text-foreground/50 hover:bg-white"}`}>
            Todas etiquetas
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTag(tag === t ? null : t)} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${tag === t ? "bg-accent text-white" : "bg-secondary-container/30 text-primary hover:bg-secondary-container/50"}`}>
              {t}
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
