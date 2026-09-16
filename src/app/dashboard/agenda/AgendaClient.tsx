"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Stethoscope, Repeat, Video, AlertTriangle, MapPin, Pencil, CalendarDays, Trash2 } from "lucide-react";
import { SESSION_STATUS_LABELS, sessionStatusColor, sessionColorClasses, reservaVencida, RISK_LABELS, riskColor, LEGENDA_DA_AGENDA, corDaLegenda, STATUS_OFERECIDOS, STATUS_QUE_PODEM_COBRAR, type RiskLevel } from "@/lib/therapy";
import { updateSessionStatus, confirmSession, createSessionFromAgenda, createRecurring } from "../sessions/actions";
import { HolidaySetup } from "@/components/dashboard/HolidaySetup";
import { HOLIDAY_STYLE, type Holiday, type HolidayCity } from "@/lib/holidays-style";
import { geometriaDaFaixa, posicoesDoDia } from "@/lib/agendaLayout";
import { conteudoDaCelula, identificacao } from "@/lib/celulaDaAgenda";
import { textoDoBloqueio } from "@/lib/bloqueioDeHorario";
import { ehQuinzenal, espelhosDoDia, sinaisDaSessao } from "@/lib/ocupacaoDaAgenda";
import { CANAIS_DE_CONFIRMACAO, geraRepeticoes, modalidadesDe, pedeHorasAntes, pedeLocal, repeticoesDe } from "@/lib/agendamentoNovo";
import { CAMPOS_EDITAVEIS } from "@/lib/editarAgendamento";
import { contarAlcance, excluirAgendamento, salvarEdicao } from "./edicao-actions";
import { BloquearHorario } from "@/components/dashboard/BloquearHorario";
import { FUNDO_DA_JANELA, JANELA } from "@/lib/modal";
import { perguntaSeEntraNaSequencia } from "@/lib/sessaoExtra";
import { formatoNaData } from "@/lib/vigenciaDoFormato";

type PatientLite = { id: string; name: string; status: string; attendanceMode: string | null; attendanceLocation: string | null;
  /** Atendimento gratuito: a agenda marca a sessão como "social". */
  /** O que a célula escreve no lugar do nome. */
  agendaId?: string | null;
  registrationNumber?: number | null;
  paymentFormat?: string | null;
  pacoteTipo?: string | null;
  sessionFee?: string | null;
  /** Formato de pagamento no tempo: a pergunta da sessão extra depende do formato NA DATA marcada. */
  vigencias?: { formato: string; pacoteTipo: string | null; desde: string; criadoEm: string }[];
  /** Vínculo social: convive com qualquer formato de pagamento. */
  atendimentoSocial?: boolean | null;
  /** "quinzenal", "semanal"… escrito no cadastro. É daqui que sai o espelho da semana alternada. */
  frequency?: string | null;
};
type LocationLite = { name: string; address: string };

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada" | "prof_desmarcou" | "atestado";
type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string; isOnline: boolean; risk: string; meetingUrl: string | null; meetingOpenedAt: string | null; guestJoinedAt: string | null; meetingEndedAt: string | null; pendingConfirmation: boolean; patientConfirmed: boolean; rescheduleRequested: boolean; patientArrived: boolean; location: string | null; recurring: boolean; recurrenceFreq?: string | null; patientId?: string; sessionKind?: string; pkg?: { seq: number; index: number; total: number } | null; pagamentoAtrasado?: boolean; abaterDoPacote?: boolean; codigo?: string | null };

const blockColor = (s: AgendaSession, vencida: boolean) => sessionColorClasses(s.status, s.pendingConfirmation, s.recurring, vencida);

/**
 * O símbolo de cada sinal.
 *
 * Emoji, e não ícone desenhado, de propósito: num bloco de 10px eles são o que a pessoa reconhece
 * sem legenda, e sobrevivem à impressão da agenda.
 */
const SIMBOLO: Record<string, string> = {
  pendente: "🕓",
  chegou: "🚪",
  remarcar: "🔁",
  realocada: "↪️",
  pedido: "⏳",
  confirmou: "✓",
  devendo: "💰",
  risco: "⚠️",
  online: "📹",
};

/** O que cada símbolo quer dizer, em duas ou três palavras. */
const LEGENDA_DO_SINAL: Record<string, string> = {
  pendente: "reserva vencida, a analisar",
  chegou: "chegou",
  remarcar: "pediu remarcação",
  realocada: "remarcada de outra data",
  pedido: "pedido pelo link, a confirmar",
  confirmou: "confirmou presença",
  devendo: "pagamento atrasado",
  risco: "histórico de faltas",
  online: "online",
};

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

type BlocoBloqueado = { id: string; date: string; duration: number; note: string | null };

export function AgendaClient({ sessions, patients = [], birthdays = [], locations = [], holidays = {}, holidayCities = [], blocks = [] }: { sessions: AgendaSession[]; patients?: PatientLite[]; birthdays?: Birthday[]; locations?: LocationLite[]; holidays?: Record<string, Holiday[]>; holidayCities?: HolidayCity[]; blocks?: BlocoBloqueado[] }) {
  /** A identificação curta de um paciente, a mesma que a célula usa. */
  const identificaPaciente = (id: string | null | undefined, nome: string) => {
    const p = patients.find((x) => x.id === id);
    return identificacao({ agendaId: p?.agendaId, registro: p?.registrationNumber, nome });
  };

  /** O que a célula escreve para aquela sessão. A regra mora em `celulaDaAgenda`, longe da tela. */
  const celula = (s: AgendaSession) => {
    const p = patients.find((x) => x.id === s.patientId);
    return conteudoDaCelula({
      agendaId: p?.agendaId,
      registro: p?.registrationNumber,
      nome: s.patientName,
      formato: p?.paymentFormat,
      tipo: s.sessionKind,
      abateDoPacote: s.abaterDoPacote,
      posicao: s.pkg ? { index: s.pkg.index, total: s.pkg.total } : null,
      // O servidor já resolveu o rótulo pelo formato do DIA da sessão; a célula só exibe.
      codigo: s.codigo,
      online: s.isOnline,
      repeticao: s.recurring ? s.recurrenceFreq : null,
      recorrente: s.recurring,
      social: p?.atendimentoSocial,
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
  const [newModalidade, setNewModalidade] = useState("presencial");
  const [newAbater, setNewAbater] = useState(false);
  const [newCanal, setNewCanal] = useState("nenhum");
  /**
   * O slot "Q" que a pessoa clicou, esperando a resposta.
   *
   * Clicar num horário intercalado não abre o agendamento direto de propósito: aquele lugar é o
   * espelho do quinzenal de outra pessoa, e quem clica ali pode estar só querendo entender por que
   * o horário aparece marcado. A pergunta nomeia o paciente que intercala — sem isso, "deseja
   * intercalar?" não diz com quem.
   */
  const [perguntaQ, setPerguntaQ] = useState<{ day: Date; hour: number; minute: number; quem: string } | null>(null);
  /** Agendamento nascido de um slot Q: a repetição semanal não entra na lista. */
  const [deSlotQ, setDeSlotQ] = useState(false);
  const [newFreq, setNewFreq] = useState("pontual");
  // Só semanal e quinzenal geram as sessões seguintes. Mensal marca uma só, e o paciente entra
  // na lista de "Lembrar agendamento" no fim do mês.
  const newRecorrente = geraRepeticoes(newFreq);
  const [newKind, setNewKind] = useState("consulta");
  const [newCharge, setNewCharge] = useState(true);
  const [newError, setNewError] = useState<string | null>(null);
  // Sessão inserida num paciente de pacote: soma à sequência ou fica fora (AVUL/GRAT).
  const [newNaSequencia, setNewNaSequencia] = useState("sim");
  const [newCobrada, setNewCobrada] = useState("");

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function toLocalInput(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function openNew(day?: Date, hour?: number, minute = 0, slotQ = false) {
    setDeSlotQ(slotQ);
    const d = day ? new Date(day) : new Date();
    if (hour != null) d.setHours(hour, minute, 0, 0);
    setNewDate(toLocalInput(d));
    setNewPatient("");
    setNewModalidade("presencial");
    setNewAbater(false);
    setNewCanal("nenhum");
    setNewKind("consulta");
    setNewFreq("pontual");
    setNewNaSequencia("sim");
    setNewCobrada("");
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
  const formatoNaDataNova = selectedPatient
    ? formatoNaData(
        (selectedPatient.vigencias ?? []).map((v) => ({ ...v, desde: new Date(v.desde), criadoEm: new Date(v.criadoEm) })),
        newDate ? new Date(newDate) : new Date(),
        { formato: selectedPatient.paymentFormat ?? "sessao", pacoteTipo: selectedPatient.pacoteTipo ?? null },
      ).formato
    : null;
  // Série (semanal/quinzenal) é o próprio ritmo do pacote; a pergunta é para a sessão inserida.
  const perguntaSequencia = !newRecorrente && perguntaSeEntraNaSequencia({ formato: formatoNaDataNova, sessionKind: newKind });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const blocksByDay = (day: Date) =>
    blocks.filter((b) => {
      const d = new Date(b.date);
      return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
    });

  const sessionsByDay = (day: Date) =>
    sessions.filter((s) => {
      const sd = new Date(s.date);
      return sd.getFullYear() === day.getFullYear() && sd.getMonth() === day.getMonth() && sd.getDate() === day.getDate();
    });

  // "Vago Quinzenal": nas semanas ALTERNADAS de um paciente quinzenal, o slot fica livre.
  // Detecta olhando 7 dias antes/depois: se há sessão quinzenal no mesmo horário a ±7 dias
  // e nada ocupando o slot neste dia, mostra um ghost clicável (encaixe pontual / outro quinzenal).
  /**
   * O espelho da semana alternada de um quinzenal.
   *
   * Antes ele saía SÓ da sessão (`recurrenceFreq === "quinzenal"`), e por isso nunca aparecia: a
   * frequência só é gravada na sessão quando o agendamento nasce pela janela de repetição, e a
   * base tem 43 pacientes quinzenais cujas sessões não guardam isso. Zero espelhos em toda a
   * agenda — marca que nunca aparece é marca que não existe. Agora a pergunta vai ao CADASTRO.
   */
  const pacienteEhQuinzenal = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return ehQuinzenal({ id, formato: p?.paymentFormat, frequencia: p?.frequency });
  };
  type Ghost = { hour: number; minute: number; duration: number; patientName: string; patientId?: string };
  const ghostsForDay = (day: Date): Ghost[] =>
    espelhosDoDia({
      dia: day,
      sessoes: sessions.map((s) => ({
        id: s.id,
        data: new Date(s.date),
        duracao: s.duration,
        pacienteId: s.patientId ?? "",
        recorrenciaQuinzenal: s.recurring && s.recurrenceFreq === "quinzenal",
      })),
      quinzenal: pacienteEhQuinzenal,
    }).map((e) => ({
      hour: e.hora,
      minute: e.minuto,
      duration: e.duracao,
      patientName: patients.find((x) => x.id === e.pacienteId)?.name ?? "—",
      patientId: e.pacienteId,
    }));

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
  const [editModalidade, setEditModalidade] = useState("presencial");
  const [editCanal, setEditCanal] = useState("nenhum");
  const [editErro, setEditErro] = useState<string | null>(null);
  /** A edição preenchida, esperando a pessoa dizer o alcance. */
  const [perguntaAlcance, setPerguntaAlcance] = useState<Record<string, string> | null>(null);
  /** A exclusão, esperando o alcance. `null` quando ninguém pediu para excluir. */
  const [perguntaExcluir, setPerguntaExcluir] = useState<{ id: string; passo: "inicio" | "proximos" } | null>(null);
  const [quantos, setQuantos] = useState<{ mesmosDias: number; todas: number } | null>(null);

  /**
   * Salvar não grava direto: junta o que foi preenchido e PERGUNTA o alcance.
   *
   * É o pedido delas, e faz sentido — quem edita um agendamento de uma série não tem como a tela
   * adivinhar se quer mexer só naquele dia ou no combinado inteiro, e escolher por ela erra
   * metade das vezes, em silêncio.
   */
  function submitEdit(formData: FormData) {
    if (!selected) return;
    setEditErro(null);
    const campos: Record<string, string> = {};
    for (const c of CAMPOS_EDITAVEIS) {
      const v = formData.get(c);
      if (v !== null) campos[c] = String(v);
    }
    setPerguntaAlcance(campos);
  }

  function aplicarEdicao(alcance: string) {
    if (!selected || !perguntaAlcance) return;
    startTransition(async () => {
      const r = await salvarEdicao({
        sessionId: selected.id,
        alcance,
        date: perguntaAlcance.date,
        duration: perguntaAlcance.duration ? Number(perguntaAlcance.duration) : undefined,
        modality: perguntaAlcance.modality,
        location: perguntaAlcance.location,
        confirmChannel: perguntaAlcance.confirmChannel,
        confirmLeadHours: perguntaAlcance.confirmLeadHours,
      });
      setPerguntaAlcance(null);
      if (!r.ok) return setEditErro(r.error ?? "Não consegui salvar.");
      setEditing(false);
      setSelected(null);
      router.refresh();
    });
  }

  function abrirExclusao(id: string) {
    setPerguntaExcluir({ id, passo: "inicio" });
    void contarAlcance(id).then(setQuantos);
  }

  function aplicarExclusao(alcance: string) {
    const alvo = perguntaExcluir?.id;
    if (!alvo) return;
    startTransition(async () => {
      const r = await excluirAgendamento(alvo, alcance);
      setPerguntaExcluir(null);
      setQuantos(null);
      if (!r.ok) return setEditErro(r.error ?? "Não consegui excluir.");
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
          <BloquearHorario />
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
        <span className="w-px h-3 bg-border mx-1" />
        {/* O TIPO de ocupação: a forma do bloco, não a cor. */}
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-900" /> Bloqueado</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-amber-400 bg-amber-400/20" /> Q — semana alternada de um quinzenal</span>
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

      {/* Os SINAIS, explicados. Símbolo sem legenda é adivinhação — e adivinhar numa agenda cheia
          é o começo de marcar em cima de alguém. */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-foreground/50">
        {Object.entries(SIMBOLO).map(([chave, simbolo]) => (
          <span key={chave} className="inline-flex items-center gap-1">
            <span aria-hidden="true">{simbolo}</span>
            {LEGENDA_DO_SINAL[chave]}
          </span>
        ))}
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
          <div className="min-w-[900px]">
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
                    {/* Horários bloqueados: fundo preto e texto branco, como elas pediram. Ficam
                        atrás das sessões — se alguém bloquear em cima de um paciente por outro
                        caminho, quem tem que aparecer é o paciente. */}
                    {blocksByDay(day).map((b) => {
                      const d = new Date(b.date);
                      const minutos = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
                      const top = Math.max(0, (minutos / 60) * HOUR_PX);
                      const height = Math.max(22, (b.duration / 60) * HOUR_PX - 2);
                      const texto = textoDoBloqueio(b.note);
                      return (
                        <div
                          key={b.id}
                          title={`${texto} · ${pad(d.getHours())}:${pad(d.getMinutes())}`}
                          style={{ top: top + 1, height }}
                          className="absolute left-1 right-1 rounded-lg bg-neutral-900 px-2 py-1 text-left overflow-hidden"
                        >
                          <p className="text-[10px] font-bold leading-tight tabular-nums text-white/70">{pad(d.getHours())}:{pad(d.getMinutes())}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide leading-tight text-white break-words" title={texto}>{texto}</p>
                        </div>
                      );
                    })}
                    {/* O slot "Q": a semana em que o quinzenal de alguém NÃO acontece. O horário fica
                        livre para outra pessoa, e a letra é o que avisa que ele é intercalado — quem
                        marcar ali toda semana tira o lugar do quinzenal original. */}
                    {ghostsForDay(day).map((g, gi) => {
                      const top = Math.max(0, (((g.hour - START_HOUR) * 60 + g.minute) / 60) * HOUR_PX);
                      const height = Math.max(26, (g.duration / 60) * HOUR_PX - 2);
                      const hh = `${pad(g.hour)}:${pad(g.minute)}`;
                      const quem = identificaPaciente(g.patientId, g.patientName);
                      return (
                        <button
                          key={`ghost-${gi}`}
                          onClick={() => setPerguntaQ({ day, hour: g.hour, minute: g.minute, quem })}
                          title={`Horário intercalado — quinzenal de ${g.patientName}. Clique para encaixar alguém.`}
                          style={{ top: top + 1, height }}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px] border-dashed border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition"
                        >
                          <p className="text-[10px] font-bold leading-tight text-amber-700">{hh}</p>
                          <p className="text-[11px] font-black leading-tight truncate text-amber-700">Q · {quem}</p>
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
                      const vencida = reservaVencida(s.status, s.date, new Date());
                      return (
                        <button
                          key={s.id}
                          title={`${s.patientName}${s.location ? ` · ${s.location}` : ""}`}
                          onClick={() => { setAskCharge(null); setEditing(false); setSelected(s); }}
                          style={{ top: top + 1, height, left: `calc(${faixa.left} + 4px)`, width: `calc(${faixa.width} - 8px)` }}
                          className={`absolute rounded-lg px-2 py-1 text-left overflow-hidden border border-l-[3px] hover:shadow-md hover:z-10 transition ${blockColor(s, vencida)}`}
                        >
                          {/* Os SINAIS, em ordem de urgência: primeiro o que muda a conduta de hoje,
                              depois o contexto. Cada um diz uma coisa só e nenhum repete a cor. */}
                          <p className="text-[10px] font-bold leading-tight flex items-center gap-0.5">
                            <span className="shrink-0 tabular-nums mr-0.5">{time}</span>
                            {sinaisDaSessao({
                              online: s.isOnline,
                              pedidoDoPaciente: s.pendingConfirmation && !s.recurring,
                              pacienteConfirmou: s.patientConfirmed && !s.rescheduleRequested,
                              pediuRemarcacao: s.rescheduleRequested,
                              chegou: s.patientArrived,
                              pagamentoAtrasado: s.pagamentoAtrasado,
                              riscoDeFalta: s.status === "agendada" ? s.risk : null,
                              realocada: s.status === "realocada",
                              reservaVencida: vencida,
                            }).map((sinal) => (
                              <span key={sinal.chave} title={sinal.titulo} className="shrink-0 leading-none">
                                {SIMBOLO[sinal.chave]}
                              </span>
                            ))}
                          </p>
                          {/* A identificação no lugar do nome: numa coluna de um sétimo da tela cabem
                              duas linhas curtas, e quem olha a semana precisa saber DE QUEM é o
                              horário e O QUE é a sessão, não ler o nome inteiro de cada um. O nome
                              continua no título do bloco, para quem passar o mouse. */}
                          <p className="text-[11px] font-semibold leading-tight truncate" title={celula(s).identificacao}>
                            {celula(s).identificacao}
                            {celula(s).repeticao && <span className="opacity-60"> ({celula(s).repeticao})</span>}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wide truncate opacity-80 flex items-center gap-1">
                            {celula(s).repeteSemLetra && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-50" aria-label="Agendamento recorrente" />}
                            <span className="truncate">{celula(s).codigo}</span>
                            {celula(s).social && (
                              <span className="shrink-0 text-[#047857]" title="Atendimento social">SOC</span>
                            )}
                          </p>

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
        <div className={FUNDO_DA_JANELA} onClick={() => setSelected(null)}>
          <div className={`${JANELA} max-w-sm`} onClick={(e) => e.stopPropagation()}>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setEditing(true); setEditErro(null); setEditModalidade(selected.isOnline ? "online" : "presencial"); setEditCanal("nenhum"); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <Pencil className="w-4 h-4" /> Editar agendamento
                </button>
                <button onClick={() => abrirExclusao(selected.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline">
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            ) : (
              /* Só data/hora, duração, modalidade e lembrete são editáveis. Paciente, tipo e
                 repetição ficam de fora de propósito: trocar isso não é editar o agendamento, é
                 outro agendamento — e o lote pediu que ficassem inativos. */
              <form action={submitEdit} className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Data e horário</label>
                    <input name="date" type="datetime-local" defaultValue={toLocalInput(new Date(selected.date))} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Duração (min)</label>
                    <input name="duration" type="number" min={5} defaultValue={selected.duration} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/60">Modalidade</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {modalidadesDe(selected.sessionKind).map((m) => (
                      <button
                        key={m.valor}
                        type="button"
                        onClick={() => setEditModalidade(m.valor)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${editModalidade === m.valor ? "bg-primary text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}
                      >
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="modality" value={editModalidade} />
                </div>

                {pedeLocal(editModalidade) && (
                  <input name="location" defaultValue={selected.location ?? ""} placeholder="Local (presencial)" className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground/60">Lembrar sessão</label>
                  <select name="confirmChannel" value={editCanal} onChange={(e) => setEditCanal(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                    {CANAIS_DE_CONFIRMACAO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                  </select>
                  {pedeHorasAntes(editCanal) && (
                    <input name="confirmLeadHours" type="number" min={1} max={168} defaultValue={24} placeholder="horas antes" className="mt-2 w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  )}
                </div>

                {editErro && <p className="text-sm text-red-600">{editErro}</p>}

                <div className="flex gap-2">
                  <button disabled={pending} className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold disabled:opacity-60">Salvar</button>
                  <button type="button" onClick={() => { setEditing(false); setEditErro(null); }} className="px-3 py-2 rounded-xl text-sm text-foreground/50">Cancelar</button>
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
            {reservaVencida(selected.status, selected.date, new Date()) && (
              <div className="rounded-xl bg-[#ffedd5] border border-[#fb923c] p-3">
                <p className="text-xs font-semibold text-[#9a3412]">🕓 Esta reserva já passou e está <strong>pendente de análise</strong>. Escolha abaixo o que aconteceu.</p>
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

      {/* O alcance da EDIÇÃO. Mudar a data de uma sessão de uma série sem perguntar erraria
          metade das vezes, e em silêncio. */}
      {perguntaAlcance && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaAlcance(null)}>
          <div className={`${JANELA} max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Alterar quais?</p>
            <p className="text-sm text-foreground/70">Deseja alterar apenas este agendamento ou este e também os próximos?</p>
            <div className="space-y-2">
              <button disabled={pending} onClick={() => aplicarEdicao("apenas_esta")} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                Apenas este
              </button>
              <button disabled={pending} onClick={() => aplicarEdicao("mesmos_dias")} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl font-bold hover:bg-surface-container disabled:opacity-60">
                Este e os próximos, nos mesmos dias e horários
              </button>
              <button disabled={pending} onClick={() => aplicarEdicao("todas")} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl font-bold hover:bg-surface-container disabled:opacity-60">
                Este e todos os próximos
              </button>
              <button onClick={() => setPerguntaAlcance(null)} className="w-full py-2 text-sm text-foreground/40">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* O alcance da EXCLUSÃO, em dois passos: primeiro se é só este, depois, se são os próximos,
          se o bloco respeita o combinado de dia e hora ou pega tudo. Os números vêm do servidor —
          apagar em bloco sem dizer quantos é pedir confirmação no escuro. */}
      {perguntaExcluir && (
        <div className={FUNDO_DA_JANELA} onClick={() => { setPerguntaExcluir(null); setQuantos(null); }}>
          <div className={`${JANELA} max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-red-600">Excluir agendamento</p>
            {perguntaExcluir.passo === "inicio" ? (
              <>
                <p className="text-sm text-foreground/70">Excluir apenas este agendamento, ou este e os próximos?</p>
                <div className="space-y-2">
                  <button disabled={pending} onClick={() => aplicarExclusao("apenas_esta")} className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Apenas este
                  </button>
                  <button onClick={() => setPerguntaExcluir({ ...perguntaExcluir, passo: "proximos" })} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl font-bold hover:bg-surface-container">
                    Este e os próximos…
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground/70">Quais dos próximos?</p>
                <div className="space-y-2">
                  <button disabled={pending} onClick={() => aplicarExclusao("mesmos_dias")} className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Apenas os mesmos dias e horários{quantos ? ` (${quantos.mesmosDias})` : ""}
                  </button>
                  <button disabled={pending} onClick={() => aplicarExclusao("todas")} className="w-full bg-red-600/90 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Todos, em qualquer dia e hora{quantos ? ` (${quantos.todas})` : ""}
                  </button>
                </div>
              </>
            )}
            <button onClick={() => { setPerguntaExcluir(null); setQuantos(null); }} className="w-full py-2 text-sm text-foreground/40">Cancelar</button>
          </div>
        </div>
      )}

      {/* A pergunta do slot Q. Nomeia quem intercala: "deseja intercalar?" sem dizer com quem
          não é pergunta que dê para responder. */}
      {perguntaQ && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaQ(null)}>
          <div className={`${JANELA} max-w-sm`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Horário intercalado</p>
            <p className="text-sm text-foreground/70">
              Este horário intercala com o paciente <strong>{perguntaQ.quem}</strong>. Deseja intercalar um novo
              agendamento com este?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPerguntaQ(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-foreground/60 hover:bg-surface transition"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = perguntaQ;
                  setPerguntaQ(null);
                  openNew(q.day, q.hour, q.minute, true);
                }}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo atendimento */}
      {showNew && (
        <div className={FUNDO_DA_JANELA} onClick={() => setShowNew(false)}>
          <form
            action={submitNew}
            onClick={(e) => e.stopPropagation()}
            className={`${JANELA} max-w-sm`}
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

            {/* Abater do pacote: não cobra, mas OCUPA uma posição na sequência. A devolutiva comum
                acontece fora do pacote, e contá-la roubaria uma consulta do paciente. */}
            {newKind === "devolutiva" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer rounded-xl bg-[#f3e8ff] px-3 py-2">
                <input type="checkbox" checked={newAbater} onChange={(e) => setNewAbater(e.target.checked)} className="accent-primary w-4 h-4" />
                Abater do pacote (não cobra, mas conta como sessão)
              </label>
            )}
            <input type="hidden" name="abaterDoPacote" value={newKind === "devolutiva" && newAbater ? "true" : "false"} />

            {/* Regra do dono (15/09/2026): sessão inserida entre as do pacote pode ficar FORA da
                sequência. Fora, não muda numeração, contagem nem valor do pacote. */}
            {perguntaSequencia && (
              <div className="rounded-xl bg-[#fef3c7] px-3 py-2.5 space-y-2" data-testid="pergunta-sequencia">
                <p className="text-xs font-semibold text-[#92400e]">Sequência do pacote</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: "sim", r: "Adicionar à sequência do pacote" }, { v: "nao", r: "Não adicionar à sequência do pacote" }].map((o) => (
                    <button key={o.v} type="button" onClick={() => setNewNaSequencia(o.v)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition ${newNaSequencia === o.v ? "bg-[#92400e] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                      {o.r}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="naSequencia" value={newNaSequencia} />
                {newNaSequencia === "nao" && (
                  <>
                    <p className="text-xs font-semibold text-[#92400e]">Esta sessão será cobrada?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ v: "sim", r: "Sim (AVUL)" }, { v: "nao", r: "Não (GRAT)" }].map((o) => (
                        <button key={o.v} type="button" onClick={() => setNewCobrada(o.v)}
                          className={`py-2 rounded-xl text-xs font-bold transition ${newCobrada === o.v ? "bg-[#92400e] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                          {o.r}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="cobrada" value={newCobrada} />
                    {newCobrada === "sim" && (
                      <div>
                        <label className="text-[11px] font-semibold text-[#92400e]/80">Valor da sessão avulsa (R$)</label>
                        <input name="valorExtra" inputMode="decimal" required defaultValue={selectedPatient?.sessionFee ? String(selectedPatient.sessionFee).replace(".", ",") : ""}
                          placeholder="130,00" className="w-full px-3 py-2 rounded-xl bg-white border border-[#fde68a] outline-none text-sm" />
                      </div>
                    )}
                    <p className="text-[11px] text-[#92400e]/70">Fica fora do pacote: não muda a numeração, a contagem nem o valor da sequência.</p>
                  </>
                )}
              </div>
            )}

            {/* Três opções em vez de uma caixa "é online?": misto é um combinado de verdade —
                uma semana na sala, outra na chamada — e não cabia num sim ou não. A devolutiva
                não oferece misto: é um encontro único com os responsáveis. */}
            <div>
              <label className="text-xs font-semibold text-foreground/60">Modalidade</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {modalidadesDe(newKind).map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setNewModalidade(m.valor)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${newModalidade === m.valor ? "bg-primary text-white" : "bg-surface text-foreground/60 hover:bg-surface-container"}`}
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>
              <input type="hidden" name="modality" value={newModalidade} />
            </div>

            {pedeLocal(newModalidade) && (
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
                {repeticoesDe({ tipo: newKind, slotIntercalado: deSlotQ }).map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
              </select>
              {newRecorrente && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1e40af]/80">Repetir até</label>
                  <input name="until" type="date" required className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm" />
                </div>
              )}
              {deSlotQ && (
                <p className="text-[11px] text-[#1e40af]/70">
                  Horário intercalado: sem repetição semanal, para o quinzenal de {perguntaQ?.quem ?? "quem já usa"} não perder o lugar.
                </p>
              )}
              {(newFreq === "mensal" || newFreq === "mes") && (
                <p className="text-[11px] text-[#1e40af]/70">
                  O mensal marca só esta data. No fim do mês o paciente aparece em “Lembrar agendamento”, no Dashboard.
                </p>
              )}
              <p className="text-[11px] text-[#1e40af]/70">Para 2x na semana, crie duas repetições semanais (uma por dia).</p>
            </div>

            <input type="hidden" name="reserva" value="false" />
            <select name="status" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue="agendada">
              {STATUS_OFERECIDOS.map((k) => <option key={k} value={k}>{SESSION_STATUS_LABELS[k]}</option>)}
            </select>

            <div className="rounded-xl bg-surface/60 border border-border px-3 py-2.5 space-y-2">
              <label className="text-xs font-semibold text-foreground/60">Confirmar sessão</label>
              <select name="confirmChannel" value={newCanal} onChange={(e) => setNewCanal(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                {CANAIS_DE_CONFIRMACAO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
              </select>
              {pedeHorasAntes(newCanal) && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-foreground/50">Quantas horas antes</span>
                  <input name="confirmLeadHours" type="number" min={1} max={168} defaultValue={24} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                </label>
              )}
            </div>

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
