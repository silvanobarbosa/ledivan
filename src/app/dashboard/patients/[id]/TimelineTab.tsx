"use client";

import { CalendarDays, DollarSign, FileText, Smile, ClipboardCheck, CheckSquare } from "lucide-react";
import { formatDateTime, SESSION_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatBRL } from "@/lib/therapy";
import { SCALES, type ScaleType } from "@/lib/scales";

type Session = { id: string; date: string; status: string; notes: string | null };
type Payment = { id: string; date: string; amount: string; method: string };
type RecordEntry = { id: string; type: string; title: string | null; createdAt: string };
type Mood = { id: string; mood: number; note: string | null; loggedAt: string };
type ScaleApp = { id: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null };
type AssignmentEntry = { id: string; title: string; status: string; respondedAt: string | null };

type Ev = { date: string; kind: "sessao" | "pagamento" | "registro" | "humor" | "escala" | "tarefa"; text: string };
const EMOJI = ["", "😣", "😕", "😐", "🙂", "😄"];

const META: Record<Ev["kind"], { icon: typeof CalendarDays; color: string; label: string }> = {
  sessao: { icon: CalendarDays, color: "bg-primary/10 text-primary", label: "Sessão" },
  pagamento: { icon: DollarSign, color: "bg-[#ecfdf5] text-[#047857]", label: "Pagamento" },
  registro: { icon: FileText, color: "bg-[#f3e8ff] text-primary", label: "Prontuário" },
  humor: { icon: Smile, color: "bg-[#fffbeb] text-[#b45309]", label: "Humor" },
  escala: { icon: ClipboardCheck, color: "bg-[#eef2ff] text-[#4338ca]", label: "Escala" },
  tarefa: { icon: CheckSquare, color: "bg-[#ecfeff] text-[#0e7490]", label: "Tarefa" },
};

export function TimelineTab({
  sessions, payments, records, moodLogs, scales, assignments,
}: {
  sessions: Session[]; payments: Payment[]; records: RecordEntry[]; moodLogs: Mood[]; scales: ScaleApp[]; assignments: AssignmentEntry[];
}) {
  const ev: Ev[] = [];
  for (const s of sessions) ev.push({ date: s.date, kind: "sessao", text: `${SESSION_STATUS_LABELS[s.status]}${s.notes ? ` — ${s.notes.slice(0, 80)}` : ""}` });
  for (const p of payments) ev.push({ date: p.date, kind: "pagamento", text: `${formatBRL(p.amount)} · ${PAYMENT_METHOD_LABELS[p.method] ?? p.method}` });
  for (const r of records) ev.push({ date: r.createdAt, kind: "registro", text: `${r.type}${r.title ? ` · ${r.title}` : ""}` });
  for (const m of moodLogs) ev.push({ date: m.loggedAt, kind: "humor", text: `${EMOJI[m.mood]} ${m.mood}/5${m.note ? ` — ${m.note.slice(0, 80)}` : ""}` });
  for (const s of scales) if (s.status === "respondida" && s.appliedAt) {
    const def = SCALES[s.scaleType as ScaleType];
    ev.push({ date: s.appliedAt, kind: "escala", text: `${def?.short ?? s.scaleType}: ${s.score}/${def?.max} · ${s.severity}` });
  }
  for (const a of assignments) if (a.status === "respondida" && a.respondedAt) ev.push({ date: a.respondedAt, kind: "tarefa", text: `Tarefa respondida: ${a.title}` });

  ev.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (ev.length === 0) return <p className="text-sm text-foreground/40 py-6 text-center">Sem eventos ainda.</p>;

  return (
    <div className="relative pl-2">
      <div className="absolute left-[18px] top-2 bottom-2 w-px bg-border" />
      <div className="space-y-3">
        {ev.map((e, i) => {
          const m = META[e.kind];
          return (
            <div key={i} className="relative flex items-start gap-3 pl-1">
              <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
                <m.icon className="w-4 h-4" />
              </div>
              <div className="glass-card rounded-2xl px-4 py-2.5 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{m.label}</span>
                  <span className="text-xs text-foreground/40">{formatDateTime(e.date)}</span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5 break-words">{e.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
