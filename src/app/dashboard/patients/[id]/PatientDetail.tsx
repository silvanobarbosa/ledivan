"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession, deleteSession } from "../../sessions/actions";
import { createPayment, deletePayment } from "../../payments/actions";
import { createRecord, deleteRecord, addPriceChange, renewPackage } from "../actions";
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
  paymentStatusColor,
  patientStatusColor,
  RISK_LABELS,
  riskColor,
  type RiskLevel,
} from "@/lib/therapy";
import { Phone, Mail, MapPin, Plus, Link2, Pencil, Trash2, Video, Mic, Loader2, Receipt, FileText } from "lucide-react";

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

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const TABS = ["Dados", "Prontuário", "Espaço", "Sessões", "Pagamentos", "Linha do tempo", "Histórico"] as const;

export function PatientDetail({
  patient, sessions, payments, statusHistory, priceHistory, records, autoLinkPayments, transcriptionEnabled, risk, assignments, moodToken, moodLogs, scales, treatmentGoals, locations = [], contractHistory = [],
}: {
  patient: Patient; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; records: RecordEntry[];
  contractHistory?: ContractEntry[];
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
        <div className="glass-card rounded-[24px] p-6 space-y-4">
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
      {tab === "Espaço" && <AssignmentsTab patientId={patient.id} assignments={assignments} moodToken={moodToken} moodLogs={moodLogs} scales={scales} />}

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
              <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar sessão</button>
            </form>
          )}
          {sessions.length === 0 ? <Empty text="Nenhuma sessão registrada." /> : (
            <div className="grid gap-2">
              {sessions.map((s) => (
                <div key={s.id} className="glass-card rounded-2xl p-4 space-y-3 group">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold flex items-center gap-1.5">{formatDateTime(s.date)}{s.isOnline && <Video className="w-3.5 h-3.5 text-primary" />}</p>
                      <p className="text-sm text-foreground/50">{s.duration}min · {formatBRL(s.fee)}</p>
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
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${sessionStatusColor(s.status)}`}>
                      {SESSION_STATUS_LABELS[s.status]}
                    </span>
                    <form action={deleteSession.bind(null, s.id)}>
                      <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir sessão">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
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

      {/* Pagamentos */}
      {tab === "Pagamentos" && (
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
          {payments.length === 0 ? <Empty text="Nenhum pagamento registrado." /> : (
            <div className="grid gap-2">
              {payments.map((p) => (
                <div key={p.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 group">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {formatBRL(p.amount)}
                      {p.linkedTransactionId && <Link2 className="w-3.5 h-3.5 text-primary" />}
                    </p>
                    <p className="text-sm text-foreground/50">{formatDate(p.date)} · {PAYMENT_METHOD_LABELS[p.method]}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${paymentStatusColor(p.status)}`}>
                    {PAYMENT_STATUS_LABELS[p.status]}
                  </span>
                  {p.status === "paid" && (
                    <a href={`/recibo/${p.id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1" title="Recibo">
                      <Receipt className="w-3.5 h-3.5" /> Recibo
                    </a>
                  )}
                  <form action={deletePayment.bind(null, p.id)}>
                    <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir pagamento">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Linha do tempo */}
      {tab === "Linha do tempo" && (
        <TimelineTab sessions={sessions} payments={payments} records={records} moodLogs={moodLogs} scales={scales} assignments={assignments} />
      )}

      {/* Histórico */}
      {tab === "Histórico" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-card rounded-[24px] p-5">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">Status</p>
            {statusHistory.length === 0 ? <Empty text="Sem histórico." /> : statusHistory.map((h) => (
              <div key={h.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                <span className="capitalize">{h.status}</span><span className="text-foreground/40">{formatDate(h.date)}</span>
              </div>
            ))}
          </div>
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

          {/* Pacote */}
          <div className="glass-card rounded-[24px] p-5 sm:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Pacote</p>
              {patient.contractType === "pacote" && patient.sessionsInPacket ? (
                <span className="text-xs text-foreground/50">
                  Créditos: <strong className="text-primary">{Math.max(0, patient.sessionsInPacket - patient.packageCreditsUsed)}</strong> / {patient.sessionsInPacket} restantes
                </span>
              ) : <span className="text-xs text-foreground/40">Sem pacote ativo</span>}
            </div>

            {contractHistory.length > 0 && (
              <div className="mb-3 space-y-1">
                {contractHistory.map((h) => (
                  <div key={h.id} className="flex justify-between py-1 text-sm border-b border-border last:border-0">
                    <span>{h.description || h.type}{h.to ? ` → ${h.to}` : ""}</span>
                    <span className="text-foreground/40">{formatDate(h.date)}</span>
                  </div>
                ))}
              </div>
            )}

            <form action={renewPackage.bind(null, patient.id)} className="pt-3 border-t border-border space-y-2">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Renovar pacote</p>
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
              <p className="text-[11px] text-foreground/40">Sugestão: últimos valores. Zera os créditos usados e registra no histórico.</p>
              <button className="w-full bg-primary text-white py-2.5 rounded-xl font-bold text-sm">Renovar pacote</button>
            </form>
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
