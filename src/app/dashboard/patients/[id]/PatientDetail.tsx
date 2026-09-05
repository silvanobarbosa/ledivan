"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession, deleteSession, updateSession } from "../../sessions/actions";
import { createPayment } from "../../payments/actions";
import { createRecord, deleteRecord, updatePatientNotes, editPackage, deletePackage, includePackage } from "../actions";
import { FinanceAdjust } from "./FinanceAdjust";
import { ATTENDANCE_MODE_LABELS } from "@/lib/locations";
import { MessagePatient } from "@/components/dashboard/MessagePatient";
import { AssignmentsTab } from "./AssignmentsTab";
import { MaterialsTab } from "./MaterialsTab";
import { PatientFeatures } from "./PatientFeatures";
import { SessionSummary } from "./SessionSummary";
import { TreatmentPlan } from "./TreatmentPlan";
import { TimelineTab } from "./TimelineTab";
import { AnamneseForm } from "./AnamneseForm";
import { DailyStatusPanel } from "./DailyStatusPanel";
import { InfoTip } from "@/components/InfoTip";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  SESSION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  sessionColorClasses,
  sessionLabel,
  patientStatusColor,
  RISK_LABELS,
  riskColor,
  type RiskLevel,
} from "@/lib/therapy";
import { Phone, Mail, MapPin, Plus, Link2, Pencil, Trash2, Video, Mic, Loader2, Receipt, FileText, Stethoscope, Repeat, Download } from "lucide-react";

const FMT_LABEL: Record<string, string> = { avulso: "Avulso", mensal: "Mensal", quinzenal: "Quinzenal", pacote: "Pacote" };
const CAT_LABEL: Record<string, string> = { crianca: "Criança", adolescente: "Adolescente", adulto: "Adulto", idoso: "Idoso", casal: "Casal" };

type Patient = {
  id: string; name: string; email: string | null; phone: string | null;
  sessionFee: string; frequency: string | null; notes: string | null;
  patientStatus: string; paymentStatus: string; startedAt: string | null; address: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  contractType: string | null; paymentDay: number | null;
  attendanceMode: string | null; attendanceLocation: string | null; attendanceDay: string | null; attendanceTime: string | null;
  category: string | null; queixaPrincipal: string | null; spouseName: string | null;
  priceReviewDate: string | null;
  sessionsInPacket: number | null; packageCreditsUsed: number; deductPackageOnSession: boolean;
  tags: string | null;
  timesPerPeriod: number; paymentFormat: string;
};
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };
type Finance = { fee: number; balance: number; totalPaid: number; totalDebit: number; atendimentos: number; lastPaymentDate: string | null; lastPaymentAmount: number | null; creditSessions: number; debtSessions: number };
type LedgerEntry = { id: string; date: string; kind: "pagamento" | "sessao"; desc: string; amount: number; balance: number; payId: string | null };
type Session = { id: string; date: string; duration: number; fee: string; status: string; notes: string | null; isOnline: boolean; patientSummary: string | null; meetingUrl: string | null; pendingConfirmation: boolean; recurring: boolean; chargeable: boolean; sessionKind?: string };
type Payment = { id: string; date: string; amount: string; method: string; status: string; linkedTransactionId: string | null };
type StatusEntry = { id: string; status: string; date: string };
type PriceEntry = { id: string; valor: string; dataEfetiva: string };
type RecordEntry = { id: string; type: string; title: string | null; content: string; createdAt: string };
type AssignmentEntry = {
  id: string; token: string; title: string; instructions: string | null; responseType: string;
  status: string; dueDate: string | null; responseText: string | null; responseFileUrl: string | null;
  responseFileType: string | null; respondedAt: string | null; therapistComment: string | null;
};

const RECORD_TYPE_LABELS: Record<string, string> = { evolucao: "Evolução", anamnese: "Anamnese", nota: "Nota" };
const PATIENT_STATUS_LABELS: Record<string, string> = { ativo: "Ativo", pausado: "Pausado", inativo: "Inativo", prospect: "Prospect" };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const TABS = ["Dados", "Prontuário", "Atividades", "Materiais", "Sessões", "Financeiro", "Linha do tempo"] as const;

export function PatientDetail({
  patient, sessions, payments, statusHistory, priceHistory, records, transcriptionEnabled, risk, assignments, moodToken, moodLogs, scales, treatmentGoals, diaryEntries = [], ratings = [], consents = [], packageLabels = {}, locations = [], contractHistory = [], finance, ledger = [], sessionStats, packageInfo, recurring, statusEnabled = false, dailyStatus = [], sharedWritings = [],
}: {
  patient: Patient; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; records: RecordEntry[];
  contractHistory?: ContractEntry[];
  finance: Finance;
  ledger?: LedgerEntry[];
  sessionStats: { reservadas: number; agendadasFuturas: number; realizadasCount: number; lastRealizada: string | null };
  packageInfo: { list: { id: string; seq: number; sessions: number; used: number; remaining: number }[]; openSessions: number; currentLabel: string | null; openLabels: string[]; totalSessions: number };
  recurring: { day: string; time: string; until: string | null } | null;
  transcriptionEnabled: boolean;
  risk: { level: RiskLevel; rate: number; faltas: number; total: number };
  assignments: AssignmentEntry[];
  moodToken: string | null;
  moodLogs: { id: string; mood: number; note: string | null; loggedAt: string }[];
  scales: { id: string; token: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null }[];
  treatmentGoals: { id: string; title: string; description: string | null; status: string; progress: number; targetDate: string | null }[];
  diaryEntries?: { id: string; content: string; mood: number | null; createdAt: string }[];
  ratings?: { id: string; score: number; comment: string | null; createdAt: string }[];
  consents?: { id: string; title: string; acceptedName: string; acceptedAt: string; formUpdatedAt: string }[];
  packageLabels?: Record<string, { seq: number; index: number; total: number }>;
  locations?: { name: string; address: string }[];
  statusEnabled?: boolean;
  dailyStatus?: { id: string; emoji: string; mood: number | null; text: string | null; createdAt: string; reactionEmoji: string | null; reactionText: string | null; reactionAt: string | null }[];
  sharedWritings?: { id: string; promptTitle: string | null; content: string; sharedAt: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dados");
  const [editSess, setEditSess] = useState<string | null>(null);
  const [editPkgId, setEditPkgId] = useState<string | null>(null);
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const [payAmount, setPayAmount] = useState(patient.sessionFee);
  const feeNum = parseFloat((patient.sessionFee || "0").replace(",", ".")) || 0;
  const payNum = parseFloat((payAmount || "0").replace(",", ".")) || 0;
  const paySessions = feeNum > 0 ? Math.floor(payNum / feeNum) : 0;
  const sessHex = (status: string, pending?: boolean, recurring?: boolean) => (recurring && status !== "realizada" && status !== "cancelada" && status !== "nao_realizada") ? "#3b82f6" : pending ? "#f59e0b" : status === "realizada" ? "#22c55e" : (status === "cancelada" || status === "nao_realizada" || status === "realocada") ? "#ef4444" : "#8b5cf6";
  const PERIODO_MES: Record<string, number> = { semanal: 4, quinzenal: 2, mensal: 1 };
  const sessoesPrevistasMes = (PERIODO_MES[patient.frequency || ""] ?? 0) * (patient.timesPerPeriod || 1);
  const sessToLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const [showSession, setShowSession] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [showAnamnese, setShowAnamnese] = useState(false);
  // transcrição
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [consent, setConsent] = useState(false);
  const [audio, setAudio] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  async function runTranscription() {
    if (!audio || !consent) return;
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const fd = new FormData();
      fd.append("audio", audio);
      fd.append("patientId", patient.id);
      fd.append("consent", "true");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok) {
        setShowTranscribe(false);
        setAudio(null);
        setConsent(false);
        router.refresh();
      } else {
        setTranscribeError(data.error || "Falha ao transcrever.");
      }
    } catch {
      setTranscribeError("Erro de rede ao transcrever.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-[32px] p-6 lg:p-8 flex items-start gap-5">
        <div className="w-16 h-16 rounded-3xl bg-primary text-white flex items-center justify-center font-display font-bold text-2xl shrink-0">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-primary leading-tight">{patient.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${patientStatusColor(patient.patientStatus)}`}>
              {patient.patientStatus}
            </span>
            {risk.total >= 1 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor(risk.level)}`} title={`${risk.faltas} falta(s) em ${risk.total} sessões passadas`}>
                {RISK_LABELS[risk.level]}
              </span>
            )}
          </div>
          {patient.category === "casal" && patient.spouseName && (
            <p className="text-sm text-foreground/50 -mt-0.5">com {patient.spouseName}</p>
          )}
          {/* Linha compacta: dia de atendimento · status financeiro/crédito · mensagem */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
            {(patient.attendanceDay || patient.attendanceTime) && (
              <span className="inline-flex items-center gap-1 text-foreground/60">🕐 <span className="capitalize">{patient.attendanceDay || ""}</span> {patient.attendanceTime || ""}</span>
            )}
            <span>·</span>
            {finance.balance < 0 ? (
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#b91c1c]">⚠️ Devendo {finance.debtSessions} sessão(ões)</span>
            ) : finance.creditSessions > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857]">💳 {finance.creditSessions} sessão(ões) de crédito</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-surface text-foreground/50">Financeiro em dia</span>
            )}
            <MessagePatient patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }} compact />
          </div>
          <p className="text-foreground/50 mt-1.5 text-sm capitalize">
            {patient.frequency || "—"} · {formatBRL(patient.sessionFee)}/sessão · {FMT_LABEL[patient.paymentFormat || "avulso"] ?? "Avulso"}
            {patient.category ? <span className="text-foreground/40"> · {CAT_LABEL[patient.category] ?? patient.category}</span> : null}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-foreground/60 flex-wrap">
            {patient.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{patient.phone}</span>}
            {patient.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{patient.email}</span>}
          </div>
          {patient.tags && patient.tags.trim() && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {patient.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/30 text-primary">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MessagePatient patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }} />
          <a
            href={`/prontuario/${patient.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 text-primary font-semibold text-sm hover:bg-white transition"
          >
            <FileText className="w-4 h-4" /> Prontuário PDF
          </a>
          <a
            href={`/api/patients/${patient.id}/export`}
            title="Baixar todos os dados deste paciente (LGPD — portabilidade)"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 text-primary font-semibold text-sm hover:bg-white transition"
          >
            <Download className="w-4 h-4" /> Exportar dados
          </a>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 text-primary font-semibold text-sm hover:bg-white transition"
          >
            <Pencil className="w-4 h-4" /> Editar
          </Link>
        </div>
      </div>

      {/* Cards de resumo — cada um leva ao detalhe correspondente */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/dashboard/reservas" className="glass-card rounded-[20px] p-4 hover:shadow-md transition">
          <p className="text-2xl font-display font-bold text-primary">{sessionStats.reservadas}</p>
          <p className="text-xs text-foreground/50">Sessões reservadas</p>
          <p className="text-[10px] text-foreground/40">criadas e não confirmadas</p>
        </Link>
        <Link href="/dashboard/agenda" className="glass-card rounded-[20px] p-4 hover:shadow-md transition">
          <p className="text-2xl font-display font-bold text-primary">{sessionStats.agendadasFuturas}</p>
          <p className="text-xs text-foreground/50">Agendadas futuras</p>
          <p className="text-[10px] text-foreground/40">inclui reservas</p>
        </Link>
        <button onClick={() => setTab("Financeiro")} className={`rounded-[20px] p-4 text-left border transition hover:shadow-md ${finance.balance < 0 ? "bg-[#fef2f2] border-[#fecaca]" : "bg-[#ecfdf5] border-[#a7f3d0]"}`}>
          <p className={`text-2xl font-display font-bold ${finance.balance < 0 ? "text-[#b91c1c]" : "text-[#047857]"}`}>
            {finance.balance < 0 ? `-${finance.debtSessions}` : finance.creditSessions}<span className="text-sm"> sess.</span>
          </p>
          <p className="text-xs text-foreground/50">Status de crédito</p>
          <p className={`text-[10px] font-semibold ${finance.balance < 0 ? "text-[#b91c1c]" : "text-[#047857]"}`}>{finance.balance < 0 ? "Devendo " : "Crédito "}{formatBRL(Math.abs(finance.balance).toFixed(2))}</p>
        </button>
        <button onClick={() => setTab("Sessões")} className="glass-card rounded-[20px] p-4 text-left hover:shadow-md transition">
          <p className="text-2xl font-display font-bold text-primary">{sessionStats.realizadasCount}</p>
          <p className="text-xs text-foreground/50">Sessões realizadas</p>
          <p className="text-[10px] text-foreground/40">{sessionStats.lastRealizada ? `última: ${formatDate(sessionStats.lastRealizada)}` : "—"}</p>
        </button>
      </div>

      {recurring && (
        <div className="rounded-2xl bg-[#dbeafe] border border-[#93c5fd] px-4 py-2.5 text-sm text-[#1e40af] flex items-center gap-2">
          <Repeat className="w-4 h-4" /> <span><strong>Agenda recorrente:</strong> {recurring.day} {recurring.time}{recurring.until ? ` · até ${formatDate(recurring.until)}` : ""}</span>
        </div>
      )}

      {/* Status do dia (consulta antes da sessão + reação). Só quando o recurso está ligado p/ este paciente. */}
      <DailyStatusPanel enabled={statusEnabled} statuses={dailyStatus} />

      {/* Escritas terapêuticas que o paciente escolheu COMPARTILHAR (as privadas nunca aparecem aqui). */}
      {sharedWritings.length > 0 && (
        <div className="rounded-[20px] border border-[#c7d2fe] bg-[#eef2ff] p-5">
          <h3 className="font-display font-bold text-primary flex items-center gap-2">✍️ Escritas compartilhadas
            <span className="text-xs font-normal text-foreground/40">({sharedWritings.length})</span>
          </h3>
          <ul className="mt-3 space-y-3">
            {sharedWritings.slice(0, 8).map((w) => (
              <li key={w.id} className="text-sm">
                {w.promptTitle && <p className="text-xs font-semibold text-primary/70">{w.promptTitle}</p>}
                <p className="text-foreground/80 whitespace-pre-wrap">{w.content}</p>
                <p className="text-[11px] text-foreground/40 mt-0.5">{formatDate(w.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PatientFeatures patientId={patient.id} />

      {/* Tabs */}
      <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t ? "bg-primary text-white" : "text-foreground/60 hover:bg-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Dados */}
      {tab === "Dados" && (
        <div className="space-y-4">
        <div className="glass-card rounded-[24px] p-6 space-y-4">
          <Field label="Status" value={PATIENT_STATUS_LABELS[patient.patientStatus] || patient.patientStatus} />
          <Field label="Queixa principal" value={patient.queixaPrincipal || "—"} />
          <Field label="Modelo de contratação" value={patient.contractType === "pacote" ? `Pacote${packageInfo.totalSessions ? ` · ${packageInfo.totalSessions} sessões` : ""}${packageInfo.list.length ? ` · ${packageInfo.openSessions} restantes` : ""}` : "Avulso"} />
          <Field label="Valor da sessão" value={formatBRL(patient.sessionFee)} />
          <Field label="Modo de atendimento" value={ATTENDANCE_MODE_LABELS[patient.attendanceMode || "presencial"] || "—"} />
          {patient.attendanceMode !== "online" && patient.attendanceLocation && <Field label="Local" value={patient.attendanceLocation} icon={<MapPin className="w-4 h-4" />} />}
          <Field label="Início" value={formatDate(patient.startedAt)} />
          <Field label="Dia de pagamento" value={patient.paymentDay ? `Dia ${patient.paymentDay}` : "—"} />
          <Field label="Status de pagamento" value={PAYMENT_STATUS_LABELS[patient.paymentStatus] || "—"} />
          {patient.address && <Field label="Endereço" value={patient.address} icon={<MapPin className="w-4 h-4" />} />}
          {patient.emergencyName && (
            <Field label="Contato emergência" value={`${patient.emergencyName} (${patient.emergencyRelationship || "—"}) · ${patient.emergencyPhone || ""}`} />
          )}
          {patient.notes && (
            <div>
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-1">Observações</p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{patient.notes}</p>
            </div>
          )}
        </div>

        {/* Histórico de status */}
        <div className="glass-card rounded-[24px] p-6">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">Histórico de status</p>
          {statusHistory.length === 0 ? <Empty text="Sem histórico." /> : statusHistory.map((h) => (
            <div key={h.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
              <span className="capitalize">{PATIENT_STATUS_LABELS[h.status] || h.status}</span><span className="text-foreground/40">{formatDate(h.date)}</span>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Prontuário */}
      {tab === "Prontuário" && (
        <div className="space-y-4">
          {/* Cabeçalho do prontuário: etiquetas + observações (editáveis, com histórico) */}
          <form action={updatePatientNotes.bind(null, patient.id)} className="glass-card rounded-[24px] p-5 space-y-3">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Cabeçalho do prontuário</p>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Etiquetas (separadas por vírgula)</label>
              <input name="tags" defaultValue={patient.tags ?? ""} className={inputCls} placeholder="ex: TCC, ansiedade, casal" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Observações</label>
              <textarea name="notes" rows={3} defaultValue={patient.notes ?? ""} className={inputCls} placeholder="Anotações gerais sobre o paciente (aparecem no topo do prontuário)" />
            </div>
            <button className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold text-sm">Salvar cabeçalho</button>
            {contractHistory.filter((h) => h.type === "tags" || h.type === "observacoes").length > 0 && (
              <div className="pt-3 border-t border-border space-y-1">
                <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-widest">Histórico de alterações</p>
                {contractHistory.filter((h) => h.type === "tags" || h.type === "observacoes").map((h) => (
                  <div key={h.id} className="flex justify-between gap-3 py-1 text-[11px] text-foreground/60 border-b border-border last:border-0">
                    <span className="truncate">{h.description}: {h.to}</span>
                    <span className="text-foreground/40 shrink-0">{formatDate(h.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </form>

          <TreatmentPlan patientId={patient.id} goals={treatmentGoals} />
          <div className="flex flex-wrap gap-4">
            <button onClick={() => setShowRecord((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
              <Plus className="w-4 h-4" /> Novo registro
            </button>
            <button onClick={() => setShowAnamnese((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
              <Plus className="w-4 h-4" /> Anamnese estruturada
            </button>
            {transcriptionEnabled && (
              <button onClick={() => setShowTranscribe((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
                <Mic className="w-4 h-4" /> Transcrever sessão (IA)
              </button>
            )}
          </div>

          {showAnamnese && <AnamneseForm patientId={patient.id} onDone={() => setShowAnamnese(false)} />}

          {transcriptionEnabled && showTranscribe && (
            <div className="glass-card rounded-[24px] p-5 space-y-3">
              <p className="text-sm font-semibold text-primary flex items-center gap-2"><Mic className="w-4 h-4" /> Transcrição por IA</p>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-foreground/70 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:text-white file:px-4 file:py-2 file:font-semibold"
              />
              <label className="flex items-start gap-2 text-sm bg-secondary-container/20 rounded-xl px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="accent-primary w-4 h-4 mt-0.5" />
                <span>Confirmo que <strong>o paciente consentiu</strong> com a gravação e transcrição desta sessão.</span>
              </label>
              {transcribeError && <p className="text-sm text-red-600">{transcribeError}</p>}
              <button
                onClick={runTranscription}
                disabled={!audio || !consent || transcribing}
                className="inline-flex items-center gap-2 bg-primary text-white py-2.5 px-5 rounded-xl font-bold disabled:opacity-50"
              >
                {transcribing ? <><Loader2 className="w-4 h-4 animate-spin" /> Transcrevendo...</> : "Gerar evolução"}
              </button>
              <p className="text-[11px] text-foreground/40">Áudio até 25MB. A evolução gerada entra no prontuário como rascunho — revise antes de usar.</p>
            </div>
          )}
          {showRecord && (
            <form action={createRecord.bind(null, patient.id)} className="glass-card rounded-[24px] p-5 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground/60">Tipo</label>
                  <select name="type" className={inputCls} defaultValue="evolucao">
                    <option value="evolucao">Evolução</option>
                    <option value="anamnese">Anamnese</option>
                    <option value="nota">Nota</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground/60">Título (opcional)</label>
                  <input name="title" className={inputCls} placeholder="ex: Sessão 12" />
                </div>
              </div>
              <textarea name="content" rows={5} required className={inputCls} placeholder="Registro clínico, evolução do paciente, observações da sessão..." />
              <button className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold">Salvar registro</button>
            </form>
          )}
          {records.length === 0 ? <Empty text="Nenhum registro no prontuário." /> : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="glass-card rounded-2xl p-5 group">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#f3e8ff] text-primary">{RECORD_TYPE_LABELS[r.type] || r.type}</span>
                      {r.title && <span className="text-sm font-semibold">{r.title}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground/40">{formatDateTime(r.createdAt)}</span>
                      <form action={deleteRecord.bind(null, r.id)}>
                        <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir registro">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Espaço do Paciente: humor + tarefas */}
      {tab === "Atividades" && (
        <>
          <AssignmentsTab patientId={patient.id} assignments={assignments} moodToken={moodToken} moodLogs={moodLogs} scales={scales} />
          {consents.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">✍️ Consentimento assinado</h3>
              <div className="space-y-2">
                {consents.map((c) => (
                  <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <div className="font-medium text-gray-700">{c.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Assinado por <b>{c.acceptedName}</b> em {new Date(c.acceptedAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ratings.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                ⭐ Avaliações das sessões
                <span className="ml-2 font-normal text-gray-400">média {(ratings.reduce((a, r) => a + r.score, 0) / ratings.length).toFixed(1)} · {ratings.length}</span>
              </h3>
              <div className="space-y-2">
                {ratings.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{"★".repeat(r.score)}<span className="text-gray-200">{"★".repeat(5 - r.score)}</span></span>
                      <span>{new Date(r.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                    </div>
                    {r.comment ? <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{r.comment}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          {diaryEntries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">📓 Diário do paciente</h3>
              <div className="space-y-2">
                {diaryEntries.map((e) => (
                  <div key={e.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      {e.mood ? <span>{["😞", "😕", "😐", "🙂", "😄"][e.mood - 1]}</span> : null}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{e.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "Materiais" && <MaterialsTab patientId={patient.id} />}

      {/* Sessões */}
      {tab === "Sessões" && (
        <div className="space-y-4">
          <button onClick={() => setShowSession((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <Plus className="w-4 h-4" /> Registrar sessão
          </button>
          {showSession && (
            <form action={createSession} className="glass-card rounded-[24px] p-5 grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <div className="sm:col-span-2"><label className="text-xs font-semibold text-foreground/60">Tipo de agenda<InfoTip text="Reserva: bloqueia o horário mas não é confirmada (confirmar depois). Confirmar: agenda efetiva." /></label>
                <select name="reserva" className={inputCls} defaultValue="false">
                  <option value="false">Confirmar agenda</option>
                  <option value="true">Só reservar (confirmar depois)</option>
                </select></div>
              <div className="sm:col-span-2"><label className="text-xs font-semibold text-foreground/60">Data/hora</label>
                <input name="date" type="datetime-local" required className={inputCls} /></div>
              <div><label className="text-xs font-semibold text-foreground/60">Duração (min)</label>
                <input name="duration" type="number" defaultValue={50} className={inputCls} /></div>
              <div><label className="text-xs font-semibold text-foreground/60">Valor</label>
                <input name="fee" inputMode="decimal" defaultValue={patient.sessionFee} className={inputCls} /></div>
              <div><label className="text-xs font-semibold text-foreground/60">Status</label>
                <select name="status" className={inputCls} defaultValue="agendada">
                  {Object.entries(SESSION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-xs font-semibold text-foreground/60">Cobrança<InfoTip text="'Cobrar' (padrão): sessão cobrável. 'Não cobrar': cortesia/devolutiva. Ao registrar o pagamento de um paciente com pacote, 1 crédito do pacote é descontado." /></label>
                <select name="chargeable" className={inputCls} defaultValue="true">
                  <option value="true">Cobrar (padrão)</option>
                  <option value="false">Não cobrar</option>
                </select></div>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="isOnline" value="on" className="accent-primary w-4 h-4" />
                <Video className="w-4 h-4 text-primary" /> Atendimento online (gera sala de vídeo)
                <InfoTip text="Cria um link de vídeo para a sessão (Jitsi por padrão, ou Google Meet se configurado em Ajustes). O botão 'Entrar' aparece na sessão e na agenda." />
              </label>
              {patient.attendanceMode !== "online" && (
                <div className="sm:col-span-2 space-y-2">
                  <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] px-3 py-2 text-xs text-[#92400e]">
                    ⚠️ Confirme o endereço do atendimento{patient.attendanceLocation ? ` — sugerido: ${patient.attendanceLocation}` : ""}.
                  </div>
                  <label className="text-xs font-semibold text-foreground/60">Local (presencial)</label>
                  {locations.length ? (
                    <select name="location" className={inputCls} defaultValue={patient.attendanceLocation || ""}>
                      <option value="">—</option>
                      {locations.map((l, i) => { const v = l.name ? `${l.name} — ${l.address}` : l.address; return <option key={i} value={v}>{v}</option>; })}
                    </select>
                  ) : (
                    <input name="location" className={inputCls} defaultValue={patient.attendanceLocation || ""} placeholder="Endereço do atendimento" />
                  )}
                </div>
              )}
              <div className="sm:col-span-2"><textarea name="notes" rows={2} placeholder="Notas da sessão" className={inputCls} /></div>
              <div className={`sm:col-span-2 text-xs rounded-xl px-3 py-2 ${finance.creditSessions >= 1 ? "bg-[#ecfdf5] text-[#047857]" : finance.balance > 0 ? "bg-[#fffbeb] text-[#92400e]" : "bg-[#fef2f2] text-[#b91c1c]"}`}>
                {finance.creditSessions >= 1
                  ? `✓ ${finance.creditSessions} sessão(ões) de crédito. Se marcar "cobrar", consome 1 crédito.`
                  : finance.balance > 0
                    ? `Crédito parcial (${formatBRL(finance.balance.toFixed(2))}). Se cobrar, o saldo pode ficar negativo.`
                    : `⚠️ Sem crédito. Se marcar "cobrar", o paciente ficará devendo.`}
              </div>
              <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar sessão</button>
            </form>
          )}
          {sessions.length === 0 ? <Empty text="Nenhuma sessão registrada." /> : (
            <div className="grid gap-2">
              {sessions.map((s) => (
                <div key={s.id} style={{ borderLeftColor: sessHex(s.status, s.pendingConfirmation, s.recurring) }} className="glass-card rounded-2xl p-4 space-y-3 group border-l-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">{formatDateTime(s.date)}{s.isOnline ? <Video className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-foreground/40" />}{s.sessionKind === "devolutiva" && <span className="text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">Devolutiva</span>}{packageLabels[s.id] && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded">Pacote P{packageLabels[s.id].seq} · {packageLabels[s.id].index}/{packageLabels[s.id].total}</span>}</p>
                      <p className="text-sm text-foreground/50">{s.duration}min · {formatBRL(s.fee)} {s.status === "nao_realizada" ? null : s.chargeable ? <span className="text-[#047857] font-semibold">(cobrada)</span> : <span className="text-foreground/40 font-semibold">(não cobrada)</span>} · {s.isOnline ? "Online" : "Presencial"}</p>
                    </div>
                    {s.isOnline && (
                      s.meetingUrl?.includes("meet.google.com") ? (
                        <a href={s.meetingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" /> Entrar
                        </a>
                      ) : (
                        <a href={`/dashboard/sala/${s.id}`} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" /> Entrar
                        </a>
                      )
                    )}
                    {new Date(s.date).getTime() >= todayStart && (
                      <a href={`/atender/${s.id}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1" title="Vamos atender?">
                        <Stethoscope className="w-3.5 h-3.5" /> Atender
                      </a>
                    )}
                    <button type="button" onClick={() => setEditSess(editSess === s.id ? null : s.id)} className="text-xs font-semibold text-foreground/50 hover:text-primary flex items-center gap-1" title="Editar sessão">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${sessionColorClasses(s.status, s.pendingConfirmation, s.recurring)}`}>
                      {sessionLabel(s.status, s.pendingConfirmation, s.recurring)}
                    </span>
                    <form action={deleteSession.bind(null, s.id)}>
                      <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir sessão">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                  {editSess === s.id && (
                    <form
                      action={async (fd) => { await updateSession(s.id, fd); setEditSess(null); router.refresh(); }}
                      className="rounded-xl bg-surface/60 border border-border p-3 grid sm:grid-cols-2 gap-2"
                    >
                      <div>
                        <label className="text-[11px] font-semibold text-foreground/50">Data e horário</label>
                        <input name="date" type="datetime-local" defaultValue={sessToLocal(s.date)} className={inputCls} />
                      </div>
                      <label className="flex items-center gap-2 text-sm sm:pt-6 cursor-pointer">
                        <input type="checkbox" name="isOnline" defaultChecked={s.isOnline} className="accent-primary w-4 h-4" />
                        <Video className="w-4 h-4 text-primary" /> Atendimento online
                      </label>
                      <div className="sm:col-span-2 flex gap-2">
                        <button className="bg-primary text-white py-2 px-4 rounded-xl text-sm font-bold">Salvar</button>
                        <button type="button" onClick={() => setEditSess(null)} className="px-3 py-2 rounded-xl text-sm text-foreground/50">Cancelar</button>
                      </div>
                    </form>
                  )}
                  {s.notes && <p className="text-sm text-foreground/60 whitespace-pre-wrap">{s.notes}</p>}
                  <SessionSummary
                    sessionId={s.id}
                    initialSummary={s.patientSummary}
                    hasNotes={!!s.notes}
                    patientName={patient.name}
                    patientPhone={patient.phone}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagamentos (dentro do Financeiro) */}
      {tab === "Financeiro" && (
        <div className="space-y-4">
          <button onClick={() => setShowPayment((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <Plus className="w-4 h-4" /> Registrar pagamento
          </button>
          {showPayment && (
            <form action={createPayment} className="glass-card rounded-[24px] p-5 grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="patientId" value={patient.id} />
              <div><label className="text-xs font-semibold text-foreground/60">Valor</label>
                <input name="amount" inputMode="decimal" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputCls} />
                <p className="text-[11px] mt-1 text-foreground/50">Valor/sessão atual: <strong>{formatBRL(patient.sessionFee)}</strong> · credita <strong className="text-[#047857]">{paySessions} sessão(ões)</strong></p>
              </div>
              <div><label className="text-xs font-semibold text-foreground/60">Data</label>
                <input name="date" type="date" className={inputCls} /></div>
              <div><label className="text-xs font-semibold text-foreground/60">Método</label>
                <select name="method" className={inputCls} defaultValue="pix">
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-xs font-semibold text-foreground/60">Status</label>
                <select name="status" className={inputCls} defaultValue="paid">
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              {packageInfo.list.length > 0 && (
                <div className="sm:col-span-2"><label className="text-xs font-semibold text-foreground/60">Vincular a pacote</label>
                  <select name="packageId" className={inputCls} defaultValue={packageInfo.list.find((p) => p.remaining > 0)?.id ?? ""}>
                    <option value="">— Sem pacote —</option>
                    {packageInfo.list.map((p) => <option key={p.id} value={p.id}>P{p.seq} · {p.sessions} sessões ({p.remaining} restantes)</option>)}
                  </select></div>
              )}
              <p className="sm:col-span-2 flex items-center gap-2 text-xs text-foreground/50 bg-secondary-container/30 rounded-xl px-3 py-2.5">
                <Link2 className="w-4 h-4 text-primary shrink-0" />
                <span>Pagamentos <b>pagos</b> entram automaticamente no Financeiro (categoria Sessões). Créditos de pacote não contam como receita.</span>
              </p>
              <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar pagamento</button>
            </form>
          )}
          <p className="text-[11px] text-foreground/40">Os pagamentos aparecem no Fluxo financeiro abaixo (com opção de recibo).</p>
        </div>
      )}

      {/* Linha do tempo */}
      {tab === "Linha do tempo" && (
        <TimelineTab sessions={sessions} payments={payments} records={records} moodLogs={moodLogs} scales={scales} assignments={assignments} />
      )}

      {/* Financeiro */}
      {tab === "Financeiro" && (
        <div className="space-y-4">
          {/* Tipo de atendimento (resumo atual) */}
          <div className="glass-card rounded-[24px] p-5">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-1">Tipo de atendimento</p>
            <p className="text-sm text-foreground/70">
              <strong className="capitalize">{patient.frequency || "—"}</strong>, {patient.timesPerPeriod}× por período
              {patient.contractType === "pacote" && patient.sessionsInPacket ? ` · Pacote de ${patient.sessionsInPacket}` : ""}
              {" · "}{formatBRL(patient.sessionFee)}/sessão
              {patient.paymentDay ? ` · pgto dia ${patient.paymentDay}` : ""}
            </p>
            {patient.priceReviewDate && <p className="text-[11px] text-[#92400e] mt-1">⏰ Reajuste previsto para {formatDate(patient.priceReviewDate)}</p>}
          </div>

          {/* Contadores */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card rounded-[20px] p-4">
              <p className="text-2xl font-display font-bold text-primary">{sessoesPrevistasMes}</p>
              <p className="text-xs text-foreground/50">Sessões previstas no mês</p>
            </div>
            <div className="glass-card rounded-[20px] p-4">
              <p className={`text-2xl font-display font-bold ${finance.balance < 0 ? "text-[#b91c1c]" : "text-[#047857]"}`}>{finance.balance < 0 ? `-${finance.debtSessions}` : finance.creditSessions}</p>
              <p className="text-xs text-foreground/50">Crédito de sessões</p>
            </div>
            <div className="glass-card rounded-[20px] p-4">
              <p className="text-2xl font-display font-bold text-primary">{formatBRL(patient.sessionFee)}</p>
              <p className="text-xs text-foreground/50">Valor atual</p>
            </div>
          </div>

          {/* Pacotes (P1, P2, ...) */}
          <div className="glass-card rounded-[24px] p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Pacotes</p>
                {packageInfo.list.length > 0 && (
                  <span className="text-sm">
                    Em aberto: <strong className="text-primary">{packageInfo.openSessions}</strong> sessão(ões)
                    {packageInfo.currentLabel && <span className="text-foreground/50"> · vigente {packageInfo.currentLabel}</span>}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {packageInfo.list.length === 0 && <p className="text-sm text-foreground/40">Nenhum pacote.</p>}
                {packageInfo.list.map((p) => (
                  editPkgId === p.id ? (
                    <form key={p.id} action={editPackage.bind(null, p.id)} onSubmit={() => setEditPkgId(null)} className="flex flex-wrap items-end gap-2 py-2 border-b border-border last:border-0">
                      <span className="font-semibold text-sm">P{p.seq}</span>
                      <div><label className="text-[10px] text-foreground/50 block">Total de sessões</label><input name="sessions" type="number" min={1} max={200} defaultValue={p.sessions} className="w-24 px-2 py-1.5 rounded-lg bg-white border border-border text-sm" /></div>
                      <button className="bg-primary text-white px-3 py-1.5 rounded-lg font-bold text-xs">Salvar</button>
                      <button type="button" onClick={() => setEditPkgId(null)} className="text-foreground/40 text-xs">cancelar</button>
                    </form>
                  ) : (
                    <div key={p.id} className={`flex items-center justify-between py-1.5 text-sm border-b border-border last:border-0 group ${p.remaining > 0 ? "" : "opacity-50"}`}>
                      <span className="font-semibold">P{p.seq} <span className="font-normal text-foreground/50">· {p.sessions} sessões</span></span>
                      <span className="flex items-center gap-2 text-foreground/60">
                        {p.used}/{p.sessions} usadas · <strong className={p.remaining > 0 ? "text-[#047857]" : "text-foreground/40"}>{p.remaining} restantes</strong>
                        <button onClick={() => setEditPkgId(p.id)} className="text-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition" title="Editar pacote"><Pencil className="w-3.5 h-3.5" /></button>
                        <form action={deletePackage.bind(null, p.id)} onSubmit={(e) => { if (!confirm(`Excluir pacote P${p.seq}?`)) e.preventDefault(); }}>
                          <button className="text-foreground/30 hover:text-red-600 opacity-0 group-hover:opacity-100 transition" title="Excluir pacote"><Trash2 className="w-3.5 h-3.5" /></button>
                        </form>
                      </span>
                    </div>
                  )
                ))}
              </div>
              <form action={includePackage.bind(null, patient.id)} className="mt-3 pt-3 border-t border-border flex items-end gap-2 flex-wrap">
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50 block">Incluir pacote — sessões</label>
                  <input name="sessionsInPacket" type="number" min={1} max={200} required placeholder="ex: 8" className="w-24 px-3 py-2 rounded-lg bg-white border border-border text-sm" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50 block">Valor/sessão (R$)</label>
                  <input name="fee" inputMode="decimal" defaultValue={patient.sessionFee} className="w-28 px-3 py-2 rounded-lg bg-white border border-border text-sm" />
                </div>
                <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm">+ Incluir</button>
              </form>
          </div>

          {/* Histórico financeiro (valor + recorrência) — editável */}
          <FinanceAdjust priceHistory={priceHistory} contractHistory={contractHistory} />

          {/* Fluxo financeiro (no rodapé): pagamentos (+) e sessões realizadas cobráveis (−) */}
          <div className="glass-card rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Fluxo financeiro</p>
              <span className={`text-sm font-bold ${finance.balance < 0 ? "text-[#b91c1c]" : "text-[#047857]"}`}>Saldo: {formatBRL(finance.balance.toFixed(2))}</span>
            </div>
            <p className="text-[11px] text-foreground/50 mb-2">Cada sessão realizada marcada como “cobrar” desconta o valor; cada pagamento soma. O saldo pode ficar negativo (devendo).</p>
            {ledger.length === 0 ? <Empty text="Sem movimentações." /> : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 text-sm border-b border-border last:border-0">
                    <span className="flex-1 min-w-0 truncate text-foreground/70">{formatDate(l.date)} · {l.desc}</span>
                    {l.kind === "pagamento" && l.payId && (
                      <a href={`/recibo/${l.payId}`} target="_blank" rel="noreferrer" className="shrink-0 text-primary hover:underline inline-flex items-center gap-0.5 text-xs" title="Emitir recibo">
                        <Receipt className="w-3.5 h-3.5" /> recibo
                      </a>
                    )}
                    <span className={`shrink-0 font-semibold ${l.amount >= 0 ? "text-[#047857]" : "text-[#b91c1c]"}`}>{l.amount >= 0 ? "+" : ""}{formatBRL(Math.abs(l.amount).toFixed(2))}</span>
                    <span className={`shrink-0 w-24 text-right font-bold ${l.balance < 0 ? "text-[#b91c1c]" : "text-foreground/70"}`}>{formatBRL(l.balance.toFixed(2))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground/50 flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-foreground/40 py-4 text-center">{text}</p>;
}
