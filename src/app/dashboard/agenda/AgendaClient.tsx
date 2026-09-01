"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Plus, Stethoscope, Repeat, Video, AlertTriangle, MapPin, Pencil } from "lucide-react";
import { SESSION_STATUS_LABELS, sessionStatusColor, sessionColorClasses, RISK_LABELS, riskColor, type RiskLevel } from "@/lib/therapy";
import { updateSessionStatus, confirmSession, createSessionFromAgenda, updateSession, createRecurring } from "../sessions/actions";
import { HolidaySetup } from "@/components/dashboard/HolidaySetup";
import { HOLIDAY_STYLE, type Holiday, type HolidayCity } from "@/lib/holidays-style";

type PatientLite = { id: string; name: string; status: string; attendanceMode: string | null; attendanceLocation: string | null };
type LocationLite = { name: string; address: string };

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada";
type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string; isOnline: boolean; risk: string; meetingUrl: string | null; meetingOpenedAt: string | null; guestJoinedAt: string | null; meetingEndedAt: string | null; pendingConfirmation: boolean; patientConfirmed: boolean; rescheduleRequested: boolean; patientArrived: boolean; location: string | null; recurring: boolean; recurrenceFreq?: string | null; patientId?: string };

const blockColor = (s: AgendaSession) => sessionColorClasses(s.status, s.pendingConfirmation, s.recurring);

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

export function AgendaClient({ sessions, patients = [], locations = [], holidays = {}, holidayCities = [] }: { sessions: AgendaSession[]; patients?: PatientLite[]; locations?: LocationLite[]; holidays?: Record<string, Holiday[]>; holidayCities?: HolidayCity[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<AgendaSession | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Novo atendimento
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPatient, setNewPatient] = useState("");
  const [newOnline, setNewOnline] = useState(false);
  const [newRecorrente, setNewRecorrente] = useState(false);
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
    setNewRecorrente(false);
    setNewError(null);
    setShowNew(true);
  }
  function submitNew(formData: FormData) {
    setNewError(null);
    startTransition(async () => {
      const res = newRecorrente ? await createRecurring(formData) : await createSessionFromAgenda(formData);
      if (res.ok) { setShowNew(false); setNewRecorrente(false); router.refresh(); }
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

  // "Vago Quinzenal": nas semanas ALTERNADAS de um paciente quinzenal, o slot fica livre.
  // Detecta olhando 7 dias antes/depois: se há sessão quinzenal no mesmo horário a ±7 dias
  // e nada ocupando o slot neste dia, mostra um ghost clicável (encaixe pontual / outro quinzenal).
  const quinzenais = sessions.filter((s) => s.recurring && s.recurrenceFreq === "quinzenal");
  const midOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  type Ghost = { hour: number; minute: number; duration: number; patientName: string };
  const ghostsForDay = (day: Date): Ghost[] => {
    const out: Ghost[] = [];
    const seen = new Set<string>();
    const dayMid = midOf(day);
    for (const q of quinzenais) {
      const qd = new Date(q.date);
      const diffDays = Math.round((midOf(qd) - dayMid) / 86400000);
      if (Math.abs(diffDays) !== 7) continue; // semana alternada
      const key = `${q.patientName}-${qd.getHours()}:${qd.getMinutes()}`;
      if (seen.has(key)) continue;
      // se já existe sessão real neste dia e horário (outro quinzenal encaixado), não é vago
      const occupied = sessionsByDay(day).some((s) => { const sd = new Date(s.date); return sd.getHours() === qd.getHours() && sd.getMinutes() === qd.getMinutes(); });
      if (occupied) continue;
      seen.add(key);
      out.push({ hour: qd.getHours(), minute: qd.getMinutes(), duration: q.duration, patientName: q.patientName });
    }
    return out;
  };

  const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const holidaysForDay = (d: Date): Holiday[] => holidays[dayKey(d)] ?? [];

  const shift = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const [askCharge, setAskCharge] = useState<SessionStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [editOnline, setEditOnline] = useState(false);

  function submitEdit(formData: FormData) {
    if (!selected) return;
    startTransition(async () => {
      await updateSession(selected.id, formData);
      setEditing(false);
      setSelected(null);
      router.refresh();
    });
  }

  const changeStatus = (id: string, status: SessionStatus, chargeable?: boolean) => {
    startTransition(async () => {
      await updateSessionStatus(id, status, undefined, chargeable);
      setAskCharge(null);
      setSelected(null);
      router.refresh();
    });
  };

  // realizada/cancelada/realocada → pergunta se cobra; demais aplicam direto
  const pickStatus = (id: string, status: SessionStatus) => {
    if (status === "realizada" || status === "cancelada" || status === "realocada") setAskCharge(status);
    else changeStatus(id, status);
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

      <HolidaySetup cities={holidayCities} />

      {/* Nav */}
      <div className="flex items-center justify-between glass-card rounded-2xl px-4 py-3">
        <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-primary">{label}</span>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition">Hoje</button>
        </div>
        <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-foreground/50">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#fef3c7] border border-[#f59e0b]" /> Reserva</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#dbeafe] border border-[#3b82f6]" /> Recorrente</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ede9fe] border border-[#8b5cf6]" /> Agendada</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#dcfce7] border border-[#22c55e]" /> Realizada</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#fee2e2] border border-[#ef4444]" /> Não realizada</span>
        {holidayCities.length > 0 && (
          <>
            <span className="w-px h-3 bg-border mx-1" />
            {(["NACIONAL", "ESTADUAL", "MUNICIPAL", "FACULTATIVO"] as const).map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: HOLIDAY_STYLE[t].bg, border: `1px solid ${HOLIDAY_STYLE[t].border}` }} /> {HOLIDAY_STYLE[t].label}
              </span>
            ))}
          </>
        )}
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
                const hs = holidaysForDay(day);
                const top = hs[0];
                return (
                  <div key={day.toISOString()} className="flex-1 text-center py-3 border-l border-border" style={top ? { background: HOLIDAY_STYLE[top.tipo].bg } : undefined}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{DAY_NAMES[day.getDay()]}</p>
                    <p
                      className={`text-lg font-display font-bold mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full ${isToday ? "bg-primary text-white" : top ? "" : "text-primary"}`}
                      style={!isToday && top ? { color: HOLIDAY_STYLE[top.tipo].fg } : undefined}
                    >
                      {day.getDate()}
                    </p>
                    {hs.length > 0 && (
                      <div className="mt-1 px-1 space-y-0.5">
                        {hs.slice(0, 2).map((h, i) => (
                          <p key={i} className="text-[9px] leading-tight font-semibold truncate flex items-center gap-1 justify-center" title={`${h.nome}${h.cityName ? ` — ${h.cityName}` : ""} · ${HOLIDAY_STYLE[h.tipo].label}`} style={{ color: HOLIDAY_STYLE[h.tipo].fg }}>
                            <span className="inline-block px-1 rounded shrink-0" style={{ background: HOLIDAY_STYLE[h.tipo].bg, border: `1px solid ${HOLIDAY_STYLE[h.tipo].border}` }}>{HOLIDAY_STYLE[h.tipo].short}</span>
                            <span className="truncate">{h.nome}</span>
                          </p>
                        ))}
                        {hs.length > 2 && <p className="text-[9px] text-foreground/40">+{hs.length - 2} feriado(s)</p>}
                      </div>
                    )}
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
                const topHol = holidaysForDay(day)[0];
                return (
                  <div key={day.toISOString()} className={`flex-1 relative border-l border-border ${isToday ? "bg-accent/[0.04]" : ""}`} style={topHol ? { backgroundColor: `${HOLIDAY_STYLE[topHol.tipo].bg}55` } : undefined}>
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
                    {/* ghosts "Vago Quinzenal" (semana alternada do quinzenal) — clicável p/ encaixar */}
                    {ghostsForDay(day).map((g, gi) => {
                      const top = Math.max(0, (((g.hour - START_HOUR) * 60 + g.minute) / 60) * HOUR_PX);
                      const height = Math.max(26, (g.duration / 60) * HOUR_PX - 2);
                      const hh = `${pad(g.hour)}:${pad(g.minute)}`;
                      return (
                        <button
                          key={`ghost-${gi}`}
                          onClick={() => openNew(day, g.hour)}
                          title={`Vago nesta semana — quinzenal de ${g.patientName}. Clique para encaixar.`}
                          style={{ top: top + 1, height }}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px] border-dashed border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition"
                        >
                          <p className="text-[10px] font-bold leading-tight text-amber-700">{hh}</p>
                          <p className="text-[11px] font-semibold leading-tight truncate text-amber-700">Vago Quinzenal</p>
                        </button>
                      );
                    })}
                    {/* blocos de sessão */}
                    {sessionsByDay(day).map((s) => {
                      const { top, height } = blockGeom(s);
                      const time = new Date(s.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <button
                          key={s.id}
                          title={s.recurring ? "Reserva recorrente" : undefined}
                          onClick={() => { setAskCharge(null); setEditing(false); setSelected(s); }}
                          style={{ top: top + 1, height }}
                          className={`absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px] hover:shadow-md hover:z-10 transition ${blockColor(s)}`}
                        >
                          <p className="text-[10px] font-bold leading-tight flex items-center gap-1">
                            {time}
                            {s.pendingConfirmation && <span title="Aguardando confirmação">⏳</span>}
                            {s.rescheduleRequested && <span title="Paciente pediu remarcação">🔁</span>}
                            {s.patientArrived && <span title="Paciente chegou (sala de espera)">🚪</span>}
                            {s.patientConfirmed && !s.rescheduleRequested && <span title="Paciente confirmou presença" style={{ color: "#16a34a" }}>✓</span>}
                            {s.status === "agendada" && (s.risk === "alto" || s.risk === "medio") && (
                              <AlertTriangle className={`w-2.5 h-2.5 ${s.risk === "alto" ? "text-[#b91c1c]" : "text-[#b45309]"}`} />
                            )}
                          </p>
                          <p className="text-[11px] font-semibold leading-tight truncate flex items-center gap-1">
                            {s.recurring && <Repeat className="w-2.5 h-2.5 shrink-0" />}
                            {s.isOnline ? <Video className="w-2.5 h-2.5 shrink-0" /> : <MapPin className="w-2.5 h-2.5 shrink-0" />}
                            <span className="truncate">{s.patientName}</span>
                          </p>
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

            {!selected.pendingConfirmation && new Date(selected.date).setHours(0, 0, 0, 0) >= new Date().setHours(0, 0, 0, 0) && (
              <a href={`/atender/${selected.id}`} className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold hover:bg-primary-container transition">
                <Stethoscope className="w-4 h-4" /> Vamos atender?
              </a>
            )}

            {selected.pendingConfirmation && (
              <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#92400e]">⏳ Agendamento solicitado pelo link público — aguardando sua confirmação.</p>
                <button disabled={pending} onClick={() => confirm(selected.id)} className="w-full rounded-xl bg-primary text-white py-2 text-sm font-bold disabled:opacity-60">
                  Confirmar agendamento
                </button>
              </div>
            )}

            <p className="text-sm text-foreground/60 flex items-center gap-1.5">
              {selected.isOnline ? <><Video className="w-4 h-4 text-primary" /> Online</> : <><MapPin className="w-4 h-4 text-primary" /> Presencial{selected.location ? ` · ${selected.location}` : ""}</>}
            </p>

            {/* Editar sessão (data / modalidade) */}
            {!editing ? (
              <button onClick={() => { setEditing(true); setEditOnline(selected.isOnline); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <Pencil className="w-4 h-4" /> Editar (data / modalidade)
              </button>
            ) : (
              <form action={submitEdit} className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                <div>
                  <label className="text-xs font-semibold text-foreground/60">Data e horário</label>
                  <input name="date" type="datetime-local" defaultValue={toLocalInput(new Date(selected.date))} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="isOnline" checked={editOnline} onChange={(e) => setEditOnline(e.target.checked)} className="accent-primary w-4 h-4" />
                  <Video className="w-4 h-4 text-primary" /> Atendimento online
                </label>
                <div className="flex gap-2">
                  <button disabled={pending} className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold disabled:opacity-60">Salvar</button>
                  <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl text-sm text-foreground/50">Cancelar</button>
                </div>
              </form>
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
              {askCharge ? (
                <div className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                  <p className="text-sm font-semibold">Marcar como <span className="lowercase">{SESSION_STATUS_LABELS[askCharge]}</span>. Esta sessão será cobrada?</p>
                  <div className="flex gap-2">
                    <button disabled={pending} onClick={() => changeStatus(selected.id, askCharge, true)} className="flex-1 py-2 rounded-xl text-sm font-bold bg-primary text-white disabled:opacity-60">Cobrar</button>
                    <button disabled={pending} onClick={() => changeStatus(selected.id, askCharge, false)} className="flex-1 py-2 rounded-xl text-sm font-bold bg-surface text-foreground/70 hover:bg-surface-container disabled:opacity-60">Não cobrar</button>
                  </div>
                  <button onClick={() => setAskCharge(null)} className="text-xs text-foreground/40 hover:text-primary">cancelar</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SESSION_STATUS_LABELS) as SessionStatus[]).map((st) => (
                    <button
                      key={st}
                      disabled={pending}
                      onClick={() => pickStatus(selected.id, st)}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        selected.status === st ? `${sessionStatusColor(st)} ring-2 ring-primary/30` : "bg-surface text-foreground/60 hover:bg-surface-container"
                      }`}
                    >
                      {SESSION_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              )}
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

            {!newRecorrente && (
              <select name="reserva" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue="false">
                <option value="false">Confirmar agenda</option>
                <option value="true">Só reservar (confirmar depois)</option>
              </select>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer rounded-xl bg-[#dbeafe] px-3 py-2">
              <input type="checkbox" checked={newRecorrente} onChange={(e) => setNewRecorrente(e.target.checked)} className="accent-[#3b82f6] w-4 h-4" />
              <Repeat className="w-4 h-4 text-[#1e40af]" /> Reserva recorrente (semanal)
            </label>
            {newRecorrente && (
              <div>
                <label className="text-xs font-semibold text-foreground/60">Recorrente até</label>
                <input name="until" type="date" required className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
                <p className="text-[11px] text-foreground/50 mt-1">Cria uma reserva por semana, no mesmo dia/horário, até a data escolhida.</p>
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
