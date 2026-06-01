"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Trash2, Minus, Check } from "lucide-react";
import { createTreatmentGoal, updateTreatmentGoal, deleteTreatmentGoal } from "../actions";
import { formatDate } from "@/lib/therapy";

type Goal = { id: string; title: string; description: string | null; status: string; progress: number; targetDate: string | null };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const STATUS_COLOR: Record<string, string> = {
  ativo: "bg-[#f3e8ff] text-primary",
  atingido: "bg-[#ecfdf5] text-[#047857]",
  pausado: "bg-[#fffbeb] text-[#b45309]",
};

export function TreatmentPlan({ patientId, goals }: { patientId: string; goals: Goal[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [, startTransition] = useTransition();

  const bump = (g: Goal, delta: number) => {
    startTransition(async () => {
      await updateTreatmentGoal(g.id, g.progress + delta, g.status);
      router.refresh();
    });
  };
  const setStatus = (g: Goal, status: string) => {
    startTransition(async () => {
      await updateTreatmentGoal(g.id, status === "atingido" ? 100 : g.progress, status);
      router.refresh();
    });
  };

  return (
    <div className="glass-card rounded-[24px] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-primary flex items-center gap-2"><Target className="w-4 h-4" /> Plano terapêutico</p>
        <button onClick={() => setShowNew((s) => !s)} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
          <Plus className="w-4 h-4" /> Objetivo
        </button>
      </div>

      {showNew && (
        <form action={createTreatmentGoal.bind(null, patientId)} className="space-y-2 bg-surface/50 rounded-xl p-3">
          <input name="title" required placeholder="Objetivo (ex: Reduzir crises de ansiedade)" className={inputCls} />
          <textarea name="description" rows={2} placeholder="Detalhes / critério de sucesso (opcional)" className={inputCls} />
          <input name="targetDate" type="date" className={inputCls} />
          <button className="bg-primary text-white py-2 px-4 rounded-xl font-bold text-sm">Adicionar objetivo</button>
        </form>
      )}

      {goals.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhum objetivo definido ainda.</p>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="rounded-xl bg-surface/50 border border-border p-4 group space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {g.title}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLOR[g.status] ?? ""}`}>{g.status}</span>
                  </p>
                  {g.description && <p className="text-sm text-foreground/50 mt-0.5">{g.description}</p>}
                  {g.targetDate && <p className="text-xs text-foreground/40 mt-0.5">Meta até {formatDate(g.targetDate)}</p>}
                </div>
                <form action={deleteTreatmentGoal.bind(null, g.id)}>
                  <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition"><Trash2 className="w-4 h-4" /></button>
                </form>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                </div>
                <span className="text-xs font-bold text-primary w-10 text-right">{g.progress}%</span>
                <button onClick={() => bump(g, -10)} className="p-1.5 rounded-lg bg-white hover:bg-surface transition" title="-10%"><Minus className="w-3.5 h-3.5" /></button>
                <button onClick={() => bump(g, 10)} className="p-1.5 rounded-lg bg-white hover:bg-surface transition" title="+10%"><Plus className="w-3.5 h-3.5" /></button>
                {g.status !== "atingido" && (
                  <button onClick={() => setStatus(g, "atingido")} className="p-1.5 rounded-lg bg-[#ecfdf5] text-[#047857] hover:opacity-80 transition" title="Marcar atingido"><Check className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
