"use client";

import { idadeEmPalavras } from "@/lib/idade";
import { rotuloFinanceiro } from "@/lib/rotulosPaciente";
import { cobra, usaPacote } from "@/lib/reajuste";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRecord, deleteRecord, updatePatientNotes } from "../actions";
import { MessagePatient } from "@/components/dashboard/MessagePatient";
import { AssignmentsTab } from "./AssignmentsTab";
import { MaterialsTab } from "./MaterialsTab";
import { AnexosProntuario } from "./AnexosProntuario";
import { PatientFeatures } from "./PatientFeatures";
import { TreatmentPlan } from "./TreatmentPlan";
import { GeralTab } from "./GeralTab";
import { TabelaAnual } from "./TabelaAnual";
import type { LinhaNaTela } from "@/lib/geralDoPaciente";
import { AnamneseForm } from "./AnamneseForm";
import { DailyStatusPanel } from "./DailyStatusPanel";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  patientStatusColor,
  RISK_LABELS,
  riskColor,
  type RiskLevel,
} from "@/lib/therapy";
import { Phone, Plus, Pencil, Trash2, Mic, Loader2, FileText, Repeat, Download } from "lucide-react";
import { anosDisponiveis } from "@/lib/filtroDeAno";

type Patient = {
  id: string; name: string; email: string | null; phone: string | null; guardianName?: string | null; guardianPhone?: string | null;
  sessionFee: string; frequency: string | null; notes: string | null; pacoteTipo?: string | null; horasAntesPagamento?: number | null;
  patientStatus: string; paymentStatus: string; startedAt: string | null; address: string | null;
  schoolName: string | null; schoolContact: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  contractType: string | null; paymentDay: number | null;
  attendanceMode: string | null; attendanceLocation: string | null; attendanceDay: string | null; attendanceTime: string | null;
  category: string | null; isCouple?: boolean | null; birthDate?: string | Date | null;
  queixaPrincipal: string | null; spouseName: string | null;
  priceReviewDate: string | null;
  sessionsInPacket: number | null; packageCreditsUsed: number; deductPackageOnSession: boolean;
  tags: string | null;
  timesPerPeriod: number; paymentFormat: string;
};

/** Nome e CPF que o formulário de pagamento já traz preenchidos (ver `pagadorSugerido` na página). */
type Pagador = { nome: string; cpf: string };
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };
type Finance = { fee: number; balance: number; totalPaid: number; totalDebit: number; atendimentos: number; lastPaymentDate: string | null; lastPaymentAmount: number | null; creditSessions: number; debtSessions: number; nAberto: number; nAtraso: number; emAberto: number; emAtraso: number };
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
const PATIENT_STATUS_LABELS: Record<string, string> = { ativo: "Ativo", pausado: "Pausado", inativo: "Inativo", prospect: "Prospectado" };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

// Guias enxutas (dono, 16/09/2026): saíram Dados, Sessões, Financeiro e Linha do tempo. O que era a
// aba Dados virou o histórico de status abaixo do cabeçalho; o financeiro está na guia Geral.
const TABS = ["Geral", "Prontuário", "Atividades", "Materiais"] as const;

export function PatientDetail({
  patient, pagador, payments, statusHistory, records, transcriptionEnabled, risk, assignments, moodToken, moodLogs, scales, treatmentGoals, diaryEntries = [], ratings = [], consents = [], contractHistory = [], finance, sessionStats, recurring, statusEnabled = false, dailyStatus = [], sharedWritings = [], geral = [], cobrancaMessage = null,
}: {
  patient: Patient; pagador: Pagador; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; records: RecordEntry[];
  contractHistory?: ContractEntry[];
  finance: Finance;
  ledger?: LedgerEntry[];
  sessionStats: { reservadas: number; agendadasFuturas: number; realizadasCount: number; lastRealizada: string | null };
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
  /** Guia Geral: sessões e pagamentos, prontos do motor único. */
  geral?: LinhaNaTela[];
  /** Modelo da mensagem de cobrança da terapeuta (para o botão "Cobrar" da guia Geral). */
  cobrancaMessage?: string | null;
}) {
  const router = useRouter();
  // Os anos que o paciente tem: das linhas da Geral e dos pagamentos. O corrente entra sempre.
  const anosDoPaciente = anosDisponiveis([
    ...geral.map((l) => (l.tipo === "sessao" || l.tipo === "bloqueio" ? l.data : l.pagamento?.data ?? l.vencimento)),
    ...payments.map((p) => p.date),
  ]);
  const [ano, setAno] = useState(anosDoPaciente[0]);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Geral");
  // Vencimento a mostrar no cabeçalho: dia do mês (mensal/quinzenal) ou horas antes (avulso).
  const vencimentoTexto = usaPacote(patient.paymentFormat)
    ? (patient.paymentDay ? `vence dia ${patient.paymentDay}` : "")
    : patient.paymentFormat === "sessao" && patient.horasAntesPagamento
      ? `pagar até ${patient.horasAntesPagamento}h antes`
      : "";
  const statusLabel = patient.patientStatus === "inativo" ? "Inativo" : "Ativo";
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
      <div className="glass-card rounded-[32px] p-6 lg:p-8 space-y-4">
        <div className="flex items-start gap-5">
        <div className="w-16 h-16 rounded-3xl bg-primary text-white flex items-center justify-center font-display font-bold text-2xl shrink-0">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-primary leading-tight">{patient.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${patientStatusColor(patient.patientStatus)}`}>
              {statusLabel}
            </span>
            {risk.total >= 1 && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor(risk.level)}`} title={`${risk.faltas} falta(s) em ${risk.total} sessões passadas`}>
                {RISK_LABELS[risk.level]}
              </span>
            )}
          </div>
          {(patient.isCouple || patient.category === "casal") && patient.spouseName && (
            <p className="text-sm text-foreground/50 -mt-0.5">com {patient.spouseName}</p>
          )}
          {/* CAD3: financeiro (formato) · valor · vencimento · idade · casal (dono, 16/09/2026) */}
          <p className="text-foreground/60 mt-1.5 text-sm">
            {rotuloFinanceiro(patient.paymentFormat, patient.pacoteTipo)}
            {cobra(patient.paymentFormat) ? <> · {formatBRL(patient.sessionFee)}/sessão</> : null}
            {vencimentoTexto ? <span className="text-foreground/40"> · {vencimentoTexto}</span> : null}
            {idadeEmPalavras(patient.birthDate ?? null)
              ? <span className="text-foreground/40"> · {idadeEmPalavras(patient.birthDate ?? null)}</span>
              : null}
            {(patient.isCouple || patient.category === "casal") ? <span className="text-foreground/40"> · casal</span> : null}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-foreground/60 flex-wrap">
            {patient.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{patient.phone}</span>}
          </div>
          {(patient.guardianName || patient.guardianPhone) && (
            <p className="text-sm text-foreground/55 mt-1">
              Responsável: <strong className="text-foreground/70">{patient.guardianName || "—"}</strong>
              {patient.guardianPhone ? <span className="text-foreground/40"> · {patient.guardianPhone}</span> : null}
            </p>
          )}
          {patient.tags && patient.tags.trim() && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {patient.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-container/30 text-primary">{t}</span>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Os quatro botões, numa faixa própria. `flex-wrap` para que numa tela estreita eles
            desçam de linha em vez de saírem pela borda. */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Histórico de status — logo abaixo dos dados, acima dos cards (dono, 16/09/2026) */}
      {statusHistory.length > 0 && (
        <div className="glass-card rounded-[24px] p-5">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">Histórico de status</p>
          {statusHistory.map((h) => (
            <div key={h.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
              <span className="capitalize">{PATIENT_STATUS_LABELS[h.status] || h.status}</span><span className="text-foreground/40">{formatDate(h.date)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cards: sessões agendadas · em aberto · em atraso (dono, 16/09/2026) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/agenda" className="glass-card rounded-[20px] p-4 hover:shadow-md transition">
          <p className="text-2xl font-display font-bold text-primary">{sessionStats.agendadasFuturas}</p>
          <p className="text-xs text-foreground/50">Sessões agendadas</p>
        </Link>
        <button onClick={() => setTab("Geral")} className={`rounded-[20px] p-4 text-left border transition hover:shadow-md ${finance.nAberto > 0 ? "bg-[#fffbeb] border-[#fde68a]" : "glass-card border-transparent"}`}>
          <p className={`text-2xl font-display font-bold ${finance.nAberto > 0 ? "text-[#b45309]" : "text-primary"}`}>{finance.nAberto}</p>
          <p className="text-xs text-foreground/50">Em aberto</p>
          <p className="text-[10px] text-foreground/40">{finance.emAberto > 0 ? formatBRL(finance.emAberto.toFixed(2)) : "no prazo"}</p>
        </button>
        <button onClick={() => setTab("Geral")} className={`rounded-[20px] p-4 text-left border transition hover:shadow-md ${finance.nAtraso > 0 ? "bg-[#fef2f2] border-[#fecaca]" : "glass-card border-transparent"}`}>
          <p className={`text-2xl font-display font-bold ${finance.nAtraso > 0 ? "text-[#b91c1c]" : "text-primary"}`}>{finance.nAtraso}</p>
          <p className="text-xs text-foreground/50">Em atraso</p>
          <p className="text-[10px] text-foreground/40">{finance.emAtraso > 0 ? formatBRL(finance.emAtraso.toFixed(2)) : "—"}</p>
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

      {/* Geral (Controle) */}
      {tab === "Geral" && (
        <div className="space-y-4">
          {/* GER4: cabeçalho do Controle — valor da sessão + próximo reajuste */}
          <div className="glass-card rounded-[24px] p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-display font-bold text-primary">{formatBRL(patient.sessionFee)}</p>
              <p className="text-xs text-foreground/50">Valor da sessão</p>
            </div>
            {patient.priceReviewDate && (
              <p className="text-sm font-semibold text-[#92400e] flex items-center gap-1.5">⏰ Reajuste previsto para {formatDate(patient.priceReviewDate)}</p>
            )}
          </div>
          {/* O seletor de ano é ÚNICO e vem ANTES da tabela de Controle (documento de 17/09): uma
              escolha só, e as duas tabelas respondem juntas. Antes o seletor morava dentro da
              tabela de pagamentos, e dava para ler as sessões de um ano com os pagamentos de outro
              na mesma tela, sem nada avisar. Filtrar não altera nem apaga dado: só escolhe o que
              aparece. */}
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="ano-do-paciente" className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Ano</label>
            <select
              id="ano-do-paciente"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="text-sm font-semibold rounded-lg bg-white border border-border px-2.5 py-1.5 outline-none"
            >
              {anosDoPaciente.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <GeralTab patientId={patient.id} linhas={geral} ano={ano} responsavel={pagador.nome}
            responsavelCpf={pagador.cpf}
            cobrar={{ telefone: patient.guardianPhone || patient.phone, nome: patient.guardianName || patient.name, modelo: cobrancaMessage }} />
          {/* GER6: valores recebidos por mês, no MESMO ano escolhido acima */}
          <TabelaAnual payments={payments} ano={ano} />
        </div>
      )}

      {/* Dados */}
      {/* Prontuário */}
      {tab === "Prontuário" && (
        <div className="space-y-4">
          <AnexosProntuario patientId={patient.id} />
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

    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-foreground/40 py-4 text-center">{text}</p>;
}
