"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { formatBRL, patientStatusColor, paymentStatusColor, PAYMENT_STATUS_LABELS } from "@/lib/therapy";

type PatientCard = {
  id: string;
  name: string;
  phone: string | null;
  patientStatus: string;
  paymentStatus: string;
  sessionFee: string;
  frequency: string | null;
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "ativo", label: "Ativos" },
  { key: "pausado", label: "Pausados" },
  { key: "inativo", label: "Inativos" },
];

export function PatientsClient({ patients }: { patients: PatientCard[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");

  const filtered = patients.filter((p) => {
    const matchQuery = p.name.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "todos" || p.patientStatus === filter;
    return matchQuery && matchFilter;
  });

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
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-foreground/40">Nenhum paciente encontrado.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/patients/${p.id}`}
              className="glass-card rounded-[24px] p-5 flex items-center gap-4 hover:shadow-lg transition-all group"
            >
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
                <p className="text-sm text-foreground/50 truncate">
                  {p.frequency || "—"} · {formatBRL(p.sessionFee)}/sessão
                </p>
              </div>
              <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-full ${paymentStatusColor(p.paymentStatus)}`}>
                {PAYMENT_STATUS_LABELS[p.paymentStatus]}
              </span>
              <ChevronRight className="w-5 h-5 text-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
