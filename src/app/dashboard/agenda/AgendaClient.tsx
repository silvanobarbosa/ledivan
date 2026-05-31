"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SESSION_STATUS_LABELS, sessionStatusColor } from "@/lib/therapy";
import { updateSessionStatus } from "../sessions/actions";

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada";

type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string };

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

export function AgendaClient({ sessions }: { sessions: AgendaSession[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const changeStatus = (id: string, status: SessionStatus) => {
    startTransition(async () => {
      await updateSessionStatus(id, status);
      router.refresh();
    });
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const sessionsByDay = (day: Date) =>
    sessions
      .filter((s) => {
        const sd = new Date(s.date);
        return sd.getFullYear() === day.getFullYear() && sd.getMonth() === day.getMonth() && sd.getDate() === day.getDate();
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const shift = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const label = `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between glass-card rounded-2xl px-4 py-3">
        <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-display font-bold text-primary">{label}</span>
        <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="grid gap-3">
        {days.map((day) => {
          const items = sessionsByDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <div key={day.toISOString()} className="glass-card rounded-[24px] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold uppercase tracking-widest ${isToday ? "text-accent" : "text-foreground/40"}`}>
                  {DAY_NAMES[day.getDay()]} {day.getDate()}
                </span>
                {isToday && <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-bold">Hoje</span>}
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-foreground/30">Sem sessões</p>
              ) : (
                <div className="space-y-2">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 bg-white/50 rounded-xl px-3 py-2.5">
                      <span className="font-mono text-sm font-semibold text-primary">
                        {new Date(s.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex-1 font-medium truncate">{s.patientName}</span>
                      <span className="text-xs text-foreground/40 hidden sm:inline">{s.duration}min</span>
                      <select
                        value={s.status}
                        disabled={pending}
                        onChange={(e) => changeStatus(s.id, e.target.value as SessionStatus)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border-0 outline-none cursor-pointer ${sessionStatusColor(s.status)}`}
                      >
                        {Object.entries(SESSION_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
