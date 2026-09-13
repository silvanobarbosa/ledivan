"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Stethoscope, Repeat, Video, AlertTriangle, MapPin, Pencil, CalendarDays } from "lucide-react";
import { SESSION_STATUS_LABELS, sessionStatusColor, sessionColorClasses, RISK_LABELS, riskColor, LEGENDA_DA_AGENDA, corDaLegenda, STATUS_OFERECIDOS, STATUS_QUE_PODEM_COBRAR, type RiskLevel } from "@/lib/therapy";
import { updateSessionStatus, confirmSession, createSessionFromAgenda, updateSession, createRecurring } from "../sessions/actions";
import { HolidaySetup } from "@/components/dashboard/HolidaySetup";
import { HOLIDAY_STYLE, type Holiday, type HolidayCity } from "@/lib/holidays-style";
import { geometriaDaFaixa, posicoesDoDia } from "@/lib/agendaLayout";
import { conteudoDaCelula } from "@/lib/celulaDaAgenda";

type PatientLite = { id: string; name: string; status: string; attendanceMode: string | null; attendanceLocation: string | null;
  /** Atendimento gratuito: a agenda marca a sessão como "social". */
  social?: boolean;
  /** O que a célula escreve no lugar do nome. */
  agendaId?: string | null;
  registrationNumber?: number | null;
  paymentFormat?: string | null;
};
type LocationLite = { name: string; address: string };

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada" | "prof_desmarcou" | "atestado";
type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string; isOnline: boolean; risk: string; meetingUrl: string | null; meetingOpenedAt: string | null; guestJoinedAt: string | null; meetingEndedAt: string | null; pendingConfirmation: boolean; patientConfirmed: boolean; rescheduleRequested: boolean; patientArrived: boolean; location: string | null; recurring: boolean; recurrenceFreq?: string | null; patientId?: string; sessionKind?: string; pkg?: { seq: number; index: number; total: number } | null; pagamentoAtrasado?: boolean; abaterDoPacote?: boolean };

const blockColor = (s: AgendaSession) => sessionColorClasses(s.status, s.pendingConfirmation, s.recurring);

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const START_HOUR = 6;
const END_HOUR = 21;
const HOUR_PX = 64;
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

type Birthday = { name: string; month: number; day: number };

export function AgendaClient({ sessions, patients = [], birthdays = [], locations = [], holidays = {}, holidayCities = [] }: { sessions: AgendaSession[]; patients?: PatientLite[]; birthdays?: Birthday[]; locations?: LocationLite[]; holidays?: Record<string, Holiday[]>; holidayCities?: HolidayCity[] }) {
  /** O que a célula escreve para aquela sessão. A regra mora em `celulaDaAgenda`, longe da tela. */
  const celula = (s: AgendaSession) => {
    const p = patients.find((x) => x.id === s.patientId);
    return conteudoDaCelula({
      agendaId: p?.agendaId,
      registro: p?.registrationNumber,
      nome: s.patientName,
      formato: p?.social ? "gratuito" : p?.paymentFormat,
      tipo: s.sessionKind,
      abateDoPacote: s.abaterDoPacote,
      posicao: s.pkg ? { index: s.pkg.index, total: s.pkg.total } : null,
      online: s.isOnline,
      repeticao: s.recurring ? s.recurrenceFreq : null,
      recorrente: s.recurring,
    });
  };
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<AgendaSession | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Novo atendimento
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPatient, setNewPatient] = useState("");
  const [newOnline, setNewOnline] = useState(false);
  const [newFreq, setNewFreq] = useState("pontual");
  const newRecorrente = newFreq !== "pontual";
  const [newKind, setNewKind] = useState("consulta");
  const [newCharge, setNewCharge] = useState(true);
  const [newError, setNewError] = useState<string | null>(null);

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function toLocalInput(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function openNew(day?: Date, hour?: number, minute = 0) {
    const d = day ? new Date(day) : new Date();
    if (hour != null) d.setHours(hour, minute, 0, 0);
    setNewDate(toLocalInput(d));
    setNewPatient("");
    setNewOnline(false);
    setNewFreq("pontual");
    setNewError(null);
    setShowNew(true);
  }
  function submitNew(formData: FormData) {
    setNewError(null);
    startTransition(async () => {
      const res = newRecorrente ? await createRecurring(formData) : await createSessionFromAgenda(formData);
      if (res.ok) { setShowNew(false); setNewFreq("pontual"); router.refresh(); }
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
  const birthdaysForDay = (d: Date): Birthday[] => birthdays.filter((b) => b.month === d.getMonth() + 1 && b.day === d.getDate());

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

  // Pergunta "cobra?" só onde a resposta pode ser as duas. Desmarcou, Prof. desm. e Atestado
  // nunca cobram — perguntar ali seria fazer a pessoa responder sempre a mesma coisa no meio do
  // dia, e um clique a mais em quem já está com a agenda cheia é um clique que vira erro.
  const pickStatus = (id: string, status: SessionStatus) => {
    if (STATUS_QUE_PODEM_COBRAR.has(status)) setAskCharge(status);
    else changeStatus(id, status, false);
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
      <HolidaySetup cities={holidayCities} />

      {/* Nav */}
      <div className="flex items-center justify-between glass-card rounded-2xl px-4 py-3">
        <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-primary">{label}</span>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition">Hoje</button>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            Escolher data
            <input
              type="date"
              aria-label="Ir para a semana de uma data"
              className="sr-only"
              onChange={(e) => {
                // A data vem como texto (aaaa-mm-dd); montar com new Date(texto) joga para UTC e
                // pode cair no dia anterior. Por isso o split.
                const [a, m, d] = e.target.value.split("-").map(Number);
                if (a && m && d) setWeekStart(startOfWeek(new Date(a, m - 1, d)));
              }}
            />
          </label>
        </div>
        <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-3 px-1 text-[11px] text-foreground/50">
        {LEGENDA_DA_AGENDA.map((st) => {
          const { fundo, borda } = corDaLegenda(st);
          return (
            <span key={st} className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: fundo, border: `1px solid ${borda}` }} />
              {SESSION_STATUS_LABELS[st]}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-border" /> Sem status</span>
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

      {/* Devolutivas próximas (lembrete) */}
      {(() => {
        // futuras. Congelar num estado não resolve: no render do servidor o valor seria a hora do
        // servidor e mudaria na hidratação do mesmo jeito. A correção real é só renderizar este
        // bloco depois de montar, o que muda o comportamento visual e precisa de conferência no
        // navegador — fica para quando houver essa checagem.
        // Lê o relógio para listar as devolutivas futuras. Congelar num estado não resolve: no
        // render do servidor o valor seria a hora do servidor e mudaria na hidratação do mesmo
        // jeito. A correção real é só renderizar este bloco depois de montar, o que muda o
        // comportamento visual e precisa de conferência no navegador.
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        const devs = sessions.filter((s) => s.sessionKind === "devolutiva" && new Date(s.date).getTime() >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);
        if (!devs.length) return null;
        return (
          <div className="glass-card rounded-2xl p-4 border-l-4 border-primary/50">
            <p className="text-xs font-bold uppercase tracking-wide text-primary/70 mb-2">📋 Devolutivas próximas</p>
            <div className="flex flex-wrap gap-2">
              {devs.map((d) => (
                <button key={d.id} onClick={() => { setSelected(d); }} className="text-xs bg-primary/5 hover:bg-primary/10 rounded-full px-3 py-1.5 transition">
                  {d.patientName} · {new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

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
                      className={`text-sm font-display font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full tabular-nums ${isToday ? "bg-primary text-white" : top ? "" : "text-primary"}`}
                      style={!isToday && top ? { color: HOLIDAY_STYLE[top.tipo].fg } : undefined}
                    >
                      {day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </p>
                    {hs.length > 0 && (
                      <div className="mt-0.5 px-1">
                        {hs.slice(0, 2).map((h, i) => (
                          <p key={i} className="text-[9px] leading-tight font-semibold truncate" title={`${h.nome}${h.cityName ? ` — ${h.cityName}` : ""} · ${HOLIDAY_STYLE[h.tipo].label}`} style={{ color: HOLIDAY_STYLE[h.tipo].fg }}>
                            {h.nome}
                          </p>
                        ))}
                        {hs.length > 2 && <p className="text-[9px] text-foreground/40">+{hs.length - 2} feriado(s)</p>}
                      </div>
                    )}
                    {birthdaysForDay(day).length > 0 && (
                      <div className="mt-1 px-1 space-y-0.5">
                        {birthdaysForDay(day).slice(0, 2).map((b, i) => (
                          <p key={i} className="text-[9px] leading-tight font-semibold truncate flex items-center gap-0.5 justify-center text-pink-600" title={`Aniversário: ${b.name}`}>
                            🎂 <span className="truncate">{b.name.split(" ")[0]}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Corpo: gutter de horas + 7 colunas */}
            <div className="flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
              {/* Gutter */}
              <div className="w-14 shrink-0 relative border-r border-border">
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/60 pt-1 pr-2 text-right text-[10px] font-semibold tabular-nums text-foreground/50" style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}>
                    {pad(h)}:00
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
                      <div key={h} className="absolute w-full border-t border-border/60" style={{ top: (h - START_HOUR) * HOUR_PX }} />
                    ))}
                    {/* Slots clicáveis, de meia em meia hora: a sessão das 8h30 é tão comum quanto a
                        das 8h, e antes ela obrigava a abrir às 8h e corrigir o horário na janela.
                        Ficam atrás dos blocos de sessão. */}
                    {hours.flatMap((h) =>
                      [0, 30].map((min) => (
                        <button
                          key={`slot-${h}-${min}`}
                          onClick={() => openNew(day, h, min)}
                          title={`Agendar ${pad(h)}:${pad(min)}`}
                          className="absolute left-0 right-0 hover:bg-accent/10 transition-colors"
                          style={{ top: (h - START_HOUR) * HOUR_PX + (min / 60) * HOUR_PX, height: HOUR_PX / 2 }}
                        />
                      )),
                    )}
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
                    {/* Blocos de sessão. Duas no mesmo horário dividem a largura da coluna em vez
                        de uma cobrir a outra — com o fundo transparente, empilhar sobrepunha os
                        dois textos, e sessão invisível na agenda é sessão que alguém perde. */}
                    {(() => {
                      const doDia = sessionsByDay(day);
                      const faixas = posicoesDoDia(
                        doDia.map((s) => {
                          const d = new Date(s.date);
                          return { id: s.id, inicio: d.getHours() * 60 + d.getMinutes(), duracao: s.duration };
                        }),
                      );
                      return doDia.map((s) => {
                      const { top, height } = blockGeom(s);
                      const faixa = geometriaDaFaixa(faixas.get(s.id));
                      const time = new Date(s.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <button
                          key={s.id}
                          title={`${s.patientName}${s.location ? ` · ${s.location}` : ""}`}
                          onClick={() => { setAskCharge(null); setEditing(false); setSelected(s); }}
                          style={{ top: top + 1, height, left: `calc(${faixa.left} + 4px)`, width: `calc(${faixa.width} - 8px)` }}
                          className={`absolute rounded-lg px-2 py-1 text-left overflow-hidden border border-l-[3px] hover:shadow-md hover:z-10 transition ${blockColor(s)}`}
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
                          {/* A identificação no lugar do nome: numa coluna de um sétimo da tela cabem
                              duas linhas curtas, e quem olha a semana precisa saber DE QUEM é o
                              horário e O QUE é a sessão, não ler o nome inteiro de cada um. O nome
                              continua no título do bloco, para quem passar o mouse. */}
                          <p className="text-[11px] font-semibold leading-tight truncate flex items-center gap-1">
                            {s.isOnline && <Video className="w-2.5 h-2.5 shrink-0" aria-label="Online" />}
                            <span className="truncate">{celula(s).identificacao}</span>
                            {celula(s).repeticao && <span className="shrink-0 opacity-60">({celula(s).repeticao})</span>}
                            {celula(s).repeteSemLetra && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-50" aria-label="Agendamento recorrente" />}
                          </p>
                          {celula(s).codigo && (
                            <p className="text-[10px] font-bold uppercase tracking-wide truncate opacity-80">{celula(s).codigo}</p>
                          )}
                          {/* Passou do prazo de pagamento e nada entrou. É só um aviso ao profissional: a sessão
                              continua de pé, e cancelar (ou atender assim mesmo) é decisão dele. */}
                          {s.pagamentoAtrasado && <p className="text-[9px] font-bold uppercase tracking-wide text-red-600">Pagamento atrasado</p>}
                        </button>
                      );
                      });
                    })()}
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
                  {(STATUS_OFERECIDOS as readonly SessionStatus[]).map((st) => (
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

            <div>
              <label className="text-xs font-semibold text-foreground/60">Tipo</label>
              <select name="sessionKind" value={newKind} onChange={(e) => setNewKind(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm">
                <option value="consulta">Consulta</option>
                <option value="devolutiva">Devolutiva (aos responsáveis)</option>
              </select>
            </div>

            {newKind === "devolutiva" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer rounded-xl bg-[#f3e8ff] px-3 py-2">
                <input type="checkbox" name="chargeable" checked={newCharge} onChange={(e) => setNewCharge(e.target.checked)} value="true" className="accent-primary w-4 h-4" />
                Cobrar esta devolutiva
              </label>
            )}
            {/* Sem cobrar marcado explicitamente => envia false (a devolutiva pode ser cortesia). */}
            {newKind === "devolutiva" && !newCharge && <input type="hidden" name="chargeable" value="false" />}

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

            <div className="rounded-xl bg-[#dbeafe] px-3 py-2.5 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#1e40af]">
                <Repeat className="w-4 h-4" /> Repetição
              </label>
              <select name="freq" value={newFreq} onChange={(e) => setNewFreq(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm">
                <option value="pontual">Pontual (uma vez)</option>
                <option value="semanal">Semanal (1x na semana)</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
              </select>
              {newRecorrente && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1e40af]/80">Repetir até</label>
                  <input name="until" type="date" required className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm" />
                </div>
              )}
              <p className="text-[11px] text-[#1e40af]/70">Para 2x na semana, crie duas repetições semanais (uma por dia).</p>
            </div>

            {!newRecorrente && (
              <select name="reserva" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue="true">
                <option value="true">Só reservar (confirmar depois)</option>
                <option value="false">Confirmar agenda</option>
              </select>
            )}
            <select name="status" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue="agendada">
              {STATUS_OFERECIDOS.map((k) => <option key={k} value={k}>{SESSION_STATUS_LABELS[k]}</option>)}
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
