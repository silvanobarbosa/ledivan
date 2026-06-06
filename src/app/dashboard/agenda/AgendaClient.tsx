"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { SESSION_STATUS_LABELS, sessionStatusColor, RISK_LABELS, riskColor, type RiskLevel } from "@/lib/therapy";
import { updateSessionStatus, confirmSession, createSessionFromAgenda } from "../sessions/actions";
import { Video, AlertTriangle } from "lucide-react";

type PatientLite = { id: string; name: string; status: string; attendanceMode: string | null; attendanceLocation: string | null };
type LocationLite = { name: string; address: string };

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada";
type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string; isOnline: boolean; risk: string; meetingUrl: string | null; meetingOpenedAt: string | null; guestJoinedAt: string | null; meetingEndedAt: string | null; pendingConfirmation: boolean; location: string | null };

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 64;
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

export function AgendaClient({ sessions, patients = [], locations = [] }: { sessions: AgendaSession[]; patients?: PatientLite[]; locations?: LocationLite[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<AgendaSession | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Novo atendimento
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPatient, setNewPatient] = useState("");
  const [newOnline, setNewOnline] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function toLocalInput(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function openNew(day?: Date, hour?: number) {
    const d = day ? new Date(day) : new Date();
    if (hour != null) d.setHours(hour, 0, 0, 0);
    setNewDate(toLocalInput(d));
    setNewPatient("");
    setNewOnline(false);
    setNewError(null);
    setShowNew(true);
  }
  function submitNew(formData: FormData) {
    setNewError(null);
    startTransition(async () => {
      const res = await createSessionFromAgenda(formData);
      if (res.ok) { setShowNew(false); router.refresh(); }
      else setNewError(res.error || "Falha ao agendar.");
    });
  }
  const selectedPatient = patients.find((p) => p.id === newPatient);
  const suggestLoc = selectedPatient?.attendanceLocation || "";

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const sessionsByDay = (day: Date) =>
    sessions.filter((s) => {
      const sd = new Date(s.date);
      return sd.getFullYear() === day.getFullYear() && sd.getMonth() === day.getMonth() && sd.getDate() === day.getDate();
    });

  const shift = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const changeStatus = (id: string, status: SessionStatus) => {
    startTransition(async () => {
      await updateSessionStatus(id, status);
      setSelected(null);
      router.refresh();
    });
  };

  const confirm = (id: string) => {
    startTransition(async () => {
      await confirmSession(id);
      setSelected(null);
      router.refresh();
    });
  };

  const label = `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  const blockGeom = (s: AgendaSession) => {
    const d = new Date(s.date);
    const minutes = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
    const top = Math.max(0, (minutes / 60) * HOUR_PX);
    const height = Math.max(26, (s.duration / 60) * HOUR_PX - 2);
    return { top, height };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => openNew()} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition">
          <Plus className="w-5 h-5" /> Novo atendimento
        </button>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between glass-card rounded-2xl px-4 py-3">
        <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-primary">{label}</span>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition">Hoje</button>
        </div>
        <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Grade */}
      <div className="glass-card rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Cabeçalho dos dias */}
            <div className="flex border-b border-border bg-white/40">
              <div className="w-14 shrink-0" />
              {days.map((day) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={day.toISOString()} className="flex-1 text-center py-3 border-l border-border">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{DAY_NAMES[day.getDay()]}</p>
                    <p className={`text-lg font-display font-bold mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full ${isToday ? "bg-primary text-white" : "text-primary"}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Corpo: gutter de horas + 7 colunas */}
            <div className="flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
              {/* Gutter */}
              <div className="w-14 shrink-0 relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-foreground/40" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                    {h}:00
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              {days.map((day) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={day.toISOString()} className={`flex-1 relative border-l border-border ${isToday ? "bg-accent/[0.04]" : ""}`}>
                    {/* linhas de hora */}
                    {hours.map((h) => (
                      <div key={h} className="absolute w-full border-t border-border/40" style={{ top: (h - START_HOUR) * HOUR_PX }} />
                    ))}
                    {/* slots clicáveis (criar atendimento) — ficam atrás dos blocos */}
                    {hours.map((h) => (
                      <button
                        key={`slot-${h}`}
                        onClick={() => openNew(day, h)}
                        title="Novo atendimento"
                        className="absolute left-0 right-0 hover:bg-accent/5 transition-colors"
                        style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                      />
                    ))}
                    {/* blocos de sessão */}
                    {sessionsByDay(day).map((s) => {
                      const { top, height } = blockGeom(s);
                      const time = new Date(s.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          style={{ top: top + 1, height }}
                          className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px] border-primary/50 hover:shadow-md hover:z-10 transition ${sessionStatusColor(s.status)}`}
                        >
                          <p className="text-[10px] font-bold leading-tight flex items-center gap-1">
                            {time}
                            {s.pendingConfirmation && <span title="Aguardando confirmação">⏳</span>}
                            {s.status === "agendada" && (s.risk === "alto" || s.risk === "medio") && (
                              <AlertTriangle className={`w-2.5 h-2.5 ${s.risk === "alto" ? "text-[#b91c1c]" : "text-[#b45309]"}`} />
                            )}
                          </p>
                          <p className="text-[11px] font-semibold leading-tight truncate">{s.patientName}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Painel da sessão selecionada */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-[28px] p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-display font-bold text-primary">{selected.patientName}</p>
                <p className="text-sm text-foreground/50">
                  {new Date(selected.date).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {selected.duration}min
                </p>
                {(selected.risk === "alto" || selected.risk === "medio") && (
                  <span className={`inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor(selected.risk as RiskLevel)}`}>
                    <AlertTriangle className="w-3 h-3" /> {RISK_LABELS[selected.risk as RiskLevel]} de falta
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            {selected.pendingConfirmation && (
              <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#92400e]">⏳ Agendamento solicitado pelo link público — aguardando sua confirmação.</p>
                <button disabled={pending} onClick={() => confirm(selected.id)} className="w-full rounded-xl bg-primary text-white py-2 text-sm font-bold disabled:opacity-60">
                  Confirmar agendamento
                </button>
              </div>
            )}

            {!selected.isOnline && selected.location && (
              <p className="text-sm text-foreground/60 flex items-start gap-1.5"><span className="text-foreground/40">📍</span> {selected.location}</p>
            )}

            {selected.isOnline && (
              selected.meetingUrl?.includes("meet.google.com") ? (
                <a href={selected.meetingUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold hover:bg-primary-container transition">
                  <Video className="w-4 h-4" /> Entrar no Google Meet
                </a>
              ) : (
                <a href={`/dashboard/sala/${selected.id}`} className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold hover:bg-primary-container transition">
                  <Video className="w-4 h-4" /> Entrar como anfitrião
                </a>
              )
            )}
            {/* Registro da reunião */}
            {(selected.meetingOpenedAt || selected.guestJoinedAt || selected.meetingEndedAt) && (
              <div className="rounded-xl bg-surface/60 border border-border p-3 text-xs text-foreground/60 space-y-1">
                <p className="font-bold text-foreground/40 uppercase tracking-widest text-[10px]">Reunião</p>
                {selected.meetingOpenedAt && <p>Abriu: {new Date(selected.meetingOpenedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</p>}
                {selected.guestJoinedAt && <p>Convidado entrou: {new Date(selected.guestJoinedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                {selected.meetingEndedAt && <p>Encerrou: {new Date(selected.meetingEndedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Status</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SESSION_STATUS_LABELS) as SessionStatus[]).map((st) => (
                  <button
                    key={st}
                    disabled={pending}
                    onClick={() => changeStatus(selected.id, st)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      selected.status === st ? `${sessionStatusColor(st)} ring-2 ring-primary/30` : "bg-surface text-foreground/60 hover:bg-surface-container"
                    }`}
                  >
                    {SESSION_STATUS_LABELS[st]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo atendimento */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setShowNew(false)}>
          <form
            action={submitNew}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[28px] p-6 w-full max-w-sm space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-display font-bold text-primary">Novo atendimento</p>
              <button type="button" onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/60">Paciente</label>
              <select name="patientId" required value={newPatient} onChange={(e) => setNewPatient(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm">
                <option value="">Selecione…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.status === "prospect" ? " (prospect)" : ""}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-foreground/60">Data/hora</label>
                <input name="date" type="datetime-local" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/60">Duração (min)</label>
                <input name="duration" type="number" defaultValue={50} className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="isOnline" checked={newOnline} onChange={(e) => setNewOnline(e.target.checked)} className="accent-primary w-4 h-4" />
              <Video className="w-4 h-4 text-primary" /> Atendimento online
            </label>

            {!newOnline && (
              <div>
                <label className="text-xs font-semibold text-foreground/60">Local (presencial)</label>
                {locations.length ? (
                  <select name="location" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue={suggestLoc}>
                    <option value="">—</option>
                    {locations.map((l, i) => { const v = l.name ? `${l.name} — ${l.address}` : l.address; return <option key={i} value={v}>{v}</option>; })}
                  </select>
                ) : (
                  <input name="location" defaultValue={suggestLoc} placeholder="Endereço" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
                )}
                {suggestLoc && <p className="text-[11px] text-[#92400e] mt-1">⚠️ Confirme o endereço — sugerido: {suggestLoc}</p>}
              </div>
            )}

            <select name="status" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue="agendada">
              {(Object.entries(SESSION_STATUS_LABELS)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {newError && <p className="text-sm text-red-600">{newError}</p>}

            <button disabled={pending} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
              {pending ? "Salvando…" : "Agendar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
