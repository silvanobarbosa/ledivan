"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession, deleteSession, updateSession } from "../../sessions/actions";
import { createPayment } from "../../payments/actions";
import { createRecord, deleteRecord, addPriceChange, renewPackage, updateFinancialModel } from "../actions";
import { ATTENDANCE_MODE_LABELS } from "@/lib/locations";
import { AssignmentsTab } from "./AssignmentsTab";
import { SessionSummary } from "./SessionSummary";
import { TreatmentPlan } from "./TreatmentPlan";
import { TimelineTab } from "./TimelineTab";
import { AnamneseForm } from "./AnamneseForm";
import { InfoTip } from "@/components/InfoTip";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  SESSION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  sessionStatusColor,
  patientStatusColor,
  RISK_LABELS,
  riskColor,
  type RiskLevel,
} from "@/lib/therapy";
import { Phone, Mail, MapPin, Plus, Link2, Pencil, Trash2, Video, Mic, Loader2, Receipt, FileText, Stethoscope } from "lucide-react";

type Patient = {
  id: string; name: string; email: string | null; phone: string | null;
  sessionFee: string; frequency: string | null; notes: string | null;
  patientStatus: string; paymentStatus: string; startedAt: string | null; address: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  contractType: string | null; paymentDay: number | null;
  attendanceMode: string | null; attendanceLocation: string | null;
  priceReviewDate: string | null;
  sessionsInPacket: number | null; packageCreditsUsed: number; deductPackageOnSession: boolean;
};
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };
type Finance = { fee: number; balance: number; totalPaid: number; totalDebit: number; atendimentos: number; lastPaymentDate: string | null; lastPaymentAmount: number | null; creditSessions: number; debtSessions: number };
type LedgerEntry = { id: string; date: string; kind: "pagamento" | "sessao"; desc: string; amount: number; balance: number; payId: string | null };
type Session = { id: string; date: string; duration: number; fee: string; status: string; notes: string | null; isOnline: boolean; patientSummary: string | null; meetingUrl: string | null };
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

const TABS = ["Dados", "Prontuário", "Atividades", "Sessões", "Linha do tempo", "Financeiro"] as const;

export function PatientDetail({
  patient, sessions, payments, statusHistory, priceHistory, records, autoLinkPayments, transcriptionEnabled, risk, assignments, moodToken, moodLogs, scales, treatmentGoals, locations = [], contractHistory = [], finance, ledger = [],
}: {
  patient: Patient; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; records: RecordEntry[];
  contractHistory?: ContractEntry[];
  finance: Finance;
  ledger?: LedgerEntry[];
  autoLinkPayments: boolean; transcriptionEnabled: boolean;
  risk: { level: RiskLevel; rate: number; faltas: number; total: number };
  assignments: AssignmentEntry[];
  moodToken: string | null;
  moodLogs: { id: string; mood: number; note: string | null; loggedAt: string }[];
  scales: { id: string; token: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null }[];
  treatmentGoals: { id: string; title: string; description: string | null; status: string; progress: number; targetDate: string | null }[];
  locations?: { name: string; address: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dados");
  const [model, setModel] = useState(patient.contractType === "pacote" ? "pacote" : (patient.frequency || "avulso"));
  const [editSess, setEditSess] = useState<string | null>(null);
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
            <h1 className="text-2xl font-display font-bold text-primary">{patient.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${patientStatusColor(patient.patientStatus)}`}>
              {patient.patientStatus}
            </span>
            {risk.total >= 1 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor(risk.level)}`} title={`${risk.faltas} falta(s) em ${risk.total} sessões passadas`}>
                {RISK_LABELS[risk.level]}
              </span>
            )}
          </div>
          <p className="text-foreground/50 mt-1">
            {patient.frequency || "—"} · {formatBRL(patient.sessionFee)}/sessão · {patient.contractType}
          </p>
          <div className="flex gap-4 mt-3 text-sm text-foreground/60 flex-wrap">
            {patient.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{patient.phone}</span>}
            {patient.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{patient.email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/prontuario/${patient.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 text-primary font-semibold text-sm hover:bg-white transition"
          >
            <FileText className="w-4 h-4" /> Prontuário PDF
          </a>
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 text-primary font-semibold text-sm hover:bg-white transition"
          >
            <Pencil className="w-4 h-4" /> Editar
          </Link>
        </div>
      </div>

      {/* Status Financeiro */}
      <button onClick={() => setTab("Financeiro")} className="w-full text-left">
        <div className={`rounded-[24px] p-5 border ${finance.balance < 0 ? "bg-[#fef2f2] border-[#fecaca]" : "bg-[#ecfdf5] border-[#a7f3d0]"}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">Status financeiro</p>
              {finance.balance < 0 ? (
                <p className="text-2xl font-display font-bold text-[#b91c1c] mt-1">
                  Devendo {formatBRL(Math.abs(finance.balance).toFixed(2))}
                  {finance.debtSessions > 0 && <span className="text-sm font-normal"> · ~{finance.debtSessions} sessão(ões)</span>}
                </p>
              ) : (
                <p className="text-2xl font-display font-bold text-[#047857] mt-1">
                  {finance.creditSessions} sessão(ões) de crédito
                  <span className="text-sm font-normal"> · {formatBRL(finance.balance.toFixed(2))}</span>
                </p>
              )}
            </div>
            <div className="flex gap-5 text-sm">
              <div>
                <p className="text-foreground/40 text-xs">Atendimentos</p>
                <p className="font-bold text-primary">{finance.atendimentos}</p>
              </div>
              <div>
                <p className="text-foreground/40 text-xs">Último pagamento</p>
                <p className="font-bold text-primary">{finance.lastPaymentDate ? `${formatDate(finance.lastPaymentDate)} · ${formatBRL((finance.lastPaymentAmount ?? 0).toFixed(2))}` : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </button>

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
          <Field label="Modelo de contratação" value={patient.contractType === "pacote" ? `Pacote${patient.sessionsInPacket ? ` · ${patient.sessionsInPacket} sessões` : ""}${patient.sessionsInPacket ? ` · ${Math.max(0, patient.sessionsInPacket - patient.packageCreditsUsed)} restantes` : ""}` : "Avulso"} />
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
      {tab === "Atividades" && <AssignmentsTab patientId={patient.id} assignments={assignments} moodToken={moodToken} moodLogs={moodLogs} scales={scales} />}

      {/* Sessões */}
      {tab === "Sessões" && (
        <div className="space-y-4">
          <button onClick={() => setShowSession((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
            <Plus className="w-4 h-4" /> Registrar sessão
          </button>
          {showSession && (
            <form action={createSession} className="glass-card rounded-[24px] p-5 grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="patientId" value={patient.id} />
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
                <div key={s.id} className="glass-card rounded-2xl p-4 space-y-3 group">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">{formatDateTime(s.date)}{s.isOnline ? <Video className="w-3.5 h-3.5 text-primary" /> : <MapPin className="w-3.5 h-3.5 text-foreground/40" />}</p>
                      <p className="text-sm text-foreground/50">{s.duration}min · {formatBRL(s.fee)} · {s.isOnline ? "Online" : "Presencial"}</p>
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
                    <a href={`/atender/${s.id}`} className="text-xs font-bold text-primary hover:underline flex items-center gap-1" title="Vamos atender?">
                      <Stethoscope className="w-3.5 h-3.5" /> Atender
                    </a>
                    <button type="button" onClick={() => setEditSess(editSess === s.id ? null : s.id)} className="text-xs font-semibold text-foreground/50 hover:text-primary flex items-center gap-1" title="Editar sessão">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${sessionStatusColor(s.status)}`}>
                      {SESSION_STATUS_LABELS[s.status]}
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
                <input name="amount" inputMode="decimal" required defaultValue={patient.sessionFee} className={inputCls} /></div>
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
              <label className="sm:col-span-2 flex items-center gap-2 text-sm bg-secondary-container/30 rounded-xl px-3 py-2.5 cursor-pointer">
                <input type="checkbox" name="link" value="on" defaultChecked={autoLinkPayments} className="accent-primary w-4 h-4" />
                <Link2 className="w-4 h-4 text-primary" />
                <span>Lançar como receita no financeiro</span>
                <InfoTip text="Se marcado, este pagamento vira uma transação de receita no Financeiro (categoria Sessões). Pode ligar/desligar caso a caso." />
              </label>
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
          {/* Modelo financeiro (movido do cadastro base) */}
          <form action={updateFinancialModel.bind(null, patient.id)} className="glass-card rounded-[24px] p-5 space-y-3">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Modelo financeiro</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground/60">Valor da sessão (R$)</label>
                <input name="sessionFee" inputMode="decimal" defaultValue={patient.sessionFee} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/60">Dia de pagamento</label>
                <input name="paymentDay" type="number" min={1} max={31} defaultValue={patient.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Modalidade<InfoTip text="Como o atendimento é contratado: por frequência (semanal/quinzenal/mensal), avulso ou pacote. Mudanças ficam no histórico de modelo." /></label>
              <select name="billingModel" value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="avulso">Avulso</option>
                <option value="pacote">Pacote</option>
              </select>
            </div>
            {model === "pacote" && (
              <div className="grid sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-foreground/60">Atendimentos no pacote</label>
                  <input name="sessionsInPacket" type="number" min={1} max={200} defaultValue={patient.sessionsInPacket ?? ""} className={inputCls} placeholder="ex: 10" />
                </div>
                <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
                  <input type="checkbox" name="deductPackageOnSession" defaultChecked={patient.deductPackageOnSession} className="accent-primary w-4 h-4" />
                  Sessão realizada abate do pacote
                </label>
              </div>
            )}
            <button className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold text-sm">Salvar modelo financeiro</button>
          </form>

          {/* Renovar pacote (dentro do modelo financeiro) */}
          {model === "pacote" && (
            <form action={renewPackage.bind(null, patient.id)} className="glass-card rounded-[24px] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Renovar pacote</p>
                {patient.sessionsInPacket ? (
                  <span className="text-xs text-foreground/50">Créditos: <strong className="text-primary">{Math.max(0, patient.sessionsInPacket - patient.packageCreditsUsed)}</strong> / {patient.sessionsInPacket}</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Qtd de sessões</label>
                  <input name="sessionsInPacket" type="number" min={1} max={200} defaultValue={patient.sessionsInPacket ?? ""} className={inputCls} placeholder="ex: 10" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Valor (R$)</label>
                  <input name="valor" inputMode="decimal" defaultValue={patient.sessionFee} className={inputCls} />
                </div>
              </div>
              <p className="text-[11px] text-foreground/40">Zera os créditos usados e registra no histórico.</p>
              <button className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold text-sm">Renovar pacote</button>
            </form>
          )}

          {/* Histórico de modelo contratual */}
          {contractHistory.filter((h) => h.type === "model").length > 0 && (
            <div className="glass-card rounded-[24px] p-5">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Histórico de modelo</p>
              <div className="space-y-1">
                {contractHistory.filter((h) => h.type === "model").map((h) => (
                  <div key={h.id} className="flex justify-between py-1 text-sm border-b border-border last:border-0">
                    <span>{h.description || `${h.from} → ${h.to}`}</span>
                    <span className="text-foreground/40">{formatDate(h.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Preço</p>
              <span className="text-xs text-foreground/50">Atual: <strong className="text-primary">{formatBRL(patient.sessionFee)}</strong></span>
            </div>
            {patient.priceReviewDate && (
              <p className="text-[11px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2 py-1 mb-2">
                ⏰ Reajuste previsto para {formatDate(patient.priceReviewDate)}
              </p>
            )}
            {priceHistory.length === 0 ? <Empty text="Sem histórico." /> : priceHistory.map((h) => (
              <div key={h.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                <span>{formatBRL(h.valor)}</span><span className="text-foreground/40">{formatDate(h.dataEfetiva)}</span>
              </div>
            ))}

            <form action={addPriceChange.bind(null, patient.id)} className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Ajustar valor</p>
              <div>
                <label className="text-[11px] font-semibold text-foreground/50">Novo valor (R$)</label>
                <input name="valor" inputMode="decimal" required placeholder="ex: 220,00" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Vigente a partir de</label>
                  <input name="dataEfetiva" type="date" className={inputCls} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-foreground/50">Vencimento (reajuste)</label>
                  <input name="priceReviewDate" type="date" defaultValue={patient.priceReviewDate ? patient.priceReviewDate.slice(0, 10) : ""} className={inputCls} />
                </div>
              </div>
              <button className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm">Salvar ajuste</button>
            </form>
          </div>

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
