"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";

type P = { id: string; name: string; status: string; avatar: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ProntuarioPicker({ patients }: { patients: P[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const nq = norm(q.trim());
    return nq ? patients.filter((p) => norm(p.name).includes(nq)) : patients;
  }, [q, patients]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="w-4 h-4 text-foreground/40 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar paciente…"
          autoFocus
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface border border-border outline-none focus:border-primary text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-foreground/50 text-sm px-1">Nenhum paciente encontrado.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/prontuario/${p.id}`}
              className="flex items-center gap-3 glass-card rounded-2xl px-4 py-3 hover:shadow-md transition group"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm overflow-hidden shrink-0">
                {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 font-semibold text-foreground/90 truncate">{p.name}</span>
              {p.status === "prospect" && <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">Prospecção</span>}
              <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
