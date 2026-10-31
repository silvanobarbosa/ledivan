"use client";

import { idadeEmPalavras } from "@/lib/idade";
import { rotuloFinanceiro } from "@/lib/rotulosPaciente";
import { cobra } from "@/lib/reajuste";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createRecord } from "../actions";
import { RegistroItem } from "./RegistroItem";
import { useFormStatus } from "react-dom";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { AssignmentsTab } from "./AssignmentsTab";
import { DocumentosTab, type CabecalhoDoc, type DocumentoSalvo } from "./DocumentosTab";
import { AnexosProntuario } from "./AnexosProntuario";
import { PatientFeatures } from "./PatientFeatures";
import { GeralTab } from "./GeralTab";
import { TabelaAnual } from "./TabelaAnual";
import { type VigenciaTaxa } from "@/lib/taxaCartao";
import type { LinhaNaTela } from "@/lib/geralDoPaciente";
import { AnamneseTab } from "./AnamneseTab";
import { DailyStatusPanel } from "./DailyStatusPanel";
import { SessoesRealizadasCard } from "./SessoesRealizadasCard";
import {
  formatBRL,
  formatDate,
  formatDateTime,
  patientStatusColor,
  type RiskLevel,
} from "@/lib/therapy";
import { Phone, Plus, Pencil, Mic, Loader2, FileText, Repeat, Download, MessageCircle, Send, Mail } from "lucide-react";
import { MessagePatient } from "@/components/dashboard/MessagePatient";
import { anosDisponiveis } from "@/lib/filtroDeAno";
import { abrirWhatsapp } from "@/lib/whatsappLink";

type Patient = {
  id: string; name: string; email: string | null; phone: string | null; guardianName?: string | null; guardianPhone?: string | null;
  sessionFee: string; frequency: string | null; notes: string | null; pacoteTipo?: string | null; horasAntesPagamento?: number | null;
  patientStatus: string; paymentStatus: string; startedAt: string | null; address: string | null;
  schoolName: string | null; schoolContact: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  contractType: string | null; paymentDay: number | null; paymentDay2?: number | null;
  attendanceMode: string | null; attendanceLocation: string | null; attendanceDay: string | null; attendanceTime: string | null;
  category: string | null; isCouple?: boolean | null; birthDate?: string | Date | null;
  queixaPrincipal: string | null; spouseName: string | null;
  priceReviewDate: string | null;
  sessionsInPacket: number | null; packageCreditsUsed: number; deductPackageOnSession: boolean;
  tags: string | null;
  timesPerPeriod: number; paymentFormat: string | null;
};

/** Nome e CPF que o formulário de pagamento já traz preenchidos (ver `pagadorSugerido` na página). */
type Pagador = { nome: string; cpf: string };
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };
type Finance = { fee: number; balance: number; totalPaid: number; totalRecebido?: number; totalDebit: number; atendimentos: number; lastPaymentDate: string | null; lastPaymentAmount: number | null; creditSessions: number; debtSessions: number; nAberto: number; nAtraso: number; emAberto: number; emAtraso: number };
type LedgerEntry = { id: string; date: string; kind: "pagamento" | "sessao"; desc: string; amount: number; balance: number; payId: string | null };
type Session = { id: string; date: string; duration: number; fee: string; status: string; notes: string | null; isOnline: boolean; patientSummary: string | null; meetingUrl: string | null; pendingConfirmation: boolean; recurring: boolean; chargeable: boolean; sessionKind?: string };
type Payment = { id: string; date: string; amount: string; method: string; status: string; linkedTransactionId: string | null; kind?: string | null; estornadoEm?: string | null; virouCredito?: boolean };
type StatusEntry = { id: string; status: string; date: string };
type PriceEntry = { id: string; valor: string; dataEfetiva: string };
type RecordEntry = { id: string; type: string; title: string | null; content: string; createdAt: string };
type AssignmentEntry = {
  id: string; token: string; title: string; instructions: string | null; responseType: string;
  status: string; dueDate: string | null; responseText: string | null; responseFileUrl: string | null;
  responseFileType: string | null; respondedAt: string | null; therapistComment: string | null; createdAt: string;
};


/** Botão de salvar que se desabilita enquanto o envio está em curso: evita o registro duplicado
 *  do clique-duplo (prints 6.pdf, item 8). Precisa viver DENTRO do <form action>. */
function BotaoSalvar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold disabled:opacity-60">
      {pending ? "Salvando…" : children}
    </button>
  );
}
const PATIENT_STATUS_LABELS: Record<string, string> = { ativo: "Ativo", pausado: "Pausado", inativo: "Inativo", prospect: "Prospectado" };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

// Guias enxutas (dono, 16/09/2026): saíram Dados, Sessões, Financeiro e Linha do tempo. O que era a
// aba Dados virou o histórico de status abaixo do cabeçalho; o financeiro está na guia Geral.
// Doc 33: "Prontuário" renomeado para "Registros".
// Doc 33: "Anamnese" é guia própria; "Materiais" foi absorvida pela guia Atividades (+Material).
const TABS = ["Geral", "Registros", "Anamnese", "Atividades", "Documentos"] as const;

export function PatientDetail({
  patient, pagador, payments, statusHistory, records, transcriptionEnabled, risk: _risk, assignments, moodToken, moodLogs, scales, diaryEntries = [], ratings = [], consents = [], contractHistory: _contractHistory = [], finance, sessionStats, recurring, statusEnabled = false, dailyStatus = [], sharedWritings = [], geral = [], cobrancaMessage = null, anamnese = [], activities = [], documentos = [], docCabecalho, creditoDisponivel = 0, creditoAConfirmar = 0, vigenciasTaxa = [],
}: {
  patient: Patient; pagador: Pagador; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; records: RecordEntry[];
  anamnese?: { id: string; title: string; content: string; custom: boolean; updatedAt: string | null }[];
  activities?: { id: string; title: string; description: string; updatedAt: string }[];
  documentos?: DocumentoSalvo[];
  docCabecalho?: CabecalhoDoc;
  creditoDisponivel?: number;
  /** Doc 61: a parte do saldo que só abate com um "Sim" explícito em cada lançamento. */
  creditoAConfirmar?: number;
  contractHistory?: ContractEntry[];
  finance: Finance;
  ledger?: LedgerEntry[];
  sessionStats: { reservadas: number; agendadasFuturas: number; realizadasCount: number; realizadasPorMes: Record<string, number>; lastRealizada: string | null };
  recurring: { day: string; time: string; until: string | null } | null;
  transcriptionEnabled: boolean;
  risk: { level: RiskLevel; rate: number; faltas: number; total: number };
  assignments: AssignmentEntry[];
  moodToken: string | null;
  moodLogs: { id: string; mood: number; note: string | null; loggedAt: string }[];
  scales: { id: string; token: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null }[];
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
  /** Doc 50: vigências de taxa de cartão — a TabelaAnual mostra o recebido LÍQUIDO. */
  vigenciasTaxa?: VigenciaTaxa[];
  /** Doc 60: o dinheiro devolvido ao paciente, para a tabela anual registrar as duas pontas. */
  /** Doc 28: mensagens que o sistema ENVIOU ao paciente por WhatsApp (2º ícone do card). */
}) {
  const router = useRouter();
  // Os anos que o paciente tem: das linhas da Geral e dos pagamentos. O corrente entra sempre.
  const anosDoPaciente = anosDisponiveis([
    ...geral.map((l) => (l.tipo === "sessao" || l.tipo === "bloqueio" ? l.data : l.pagamento?.data ?? l.vencimento)),
    ...payments.map((p) => p.date),
  ]);
  /*
   * Doc 64: o "Gerenciar" da Carteira chega aqui com o ANO da cobrança clicada.
   *
   * "Se o usuário clicar em Gerenciar num pagamento de 2025, o sistema deve direcioná-lo para a
   * guia Geral com 2025 selecionado, mesmo que o ano selecionado antes fosse outro." Sem isto a
   * tela abria no ano corrente e o pagamento procurado não estava em lugar nenhum da tela.
   */
  const params = useSearchParams();
  const anoPedido = Number(params.get("ano"));
  const cobrancaPedida = params.get("cobranca");
  const [ano, setAno] = useState<number | "TODOS">(
    Number.isInteger(anoPedido) && anoPedido > 2000 ? anoPedido : anosDoPaciente[0],
  );

  // …e leva a tela até a cobrança, destacando-a: o ano certo sem achar a linha ainda é procurar.
  useEffect(() => {
    if (!cobrancaPedida) return;
    const alvo = document.querySelector(`[data-chave="${CSS.escape(cobrancaPedida)}"]`);
    const destino = alvo ?? document.querySelector('[data-testid="guia-geral"]');
    destino?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!(alvo instanceof HTMLElement)) return;
    alvo.classList.add("ring-2", "ring-primary", "ring-offset-2");
    const t = setTimeout(() => alvo.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 4000);
    return () => clearTimeout(t);
  }, [cobrancaPedida, ano]);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Geral");
  // Vencimento no cabeçalho (doc 28): mensal = "vence dia X"; quinzenal = os dois dias; 1ª/última
  // sessão do pacote NÃO mostram vencimento (o dia é o da sessão); avulso = horas antes.
  const diasQuinzena = [patient.paymentDay, patient.paymentDay2].filter((d) => d != null);
  const vencimentoTexto =
    patient.paymentFormat === "mensal"
      ? (patient.paymentDay ? `vence dia ${patient.paymentDay}` : "")
      : patient.paymentFormat === "quinzenal"
        ? (diasQuinzena.length ? `vence dia ${diasQuinzena.join(" e ")}` : "")
        : patient.paymentFormat === "sessao" && patient.horasAntesPagamento
          ? `pagar até ${patient.horasAntesPagamento}h antes`
          : "";
  const statusLabel = patient.patientStatus === "inativo" ? "Inativo" : "Ativo";
  const [showRecord, setShowRecord] = useState(false);
  // Doc 28: modal do histórico de WhatsApp enviado pelo sistema (2º ícone).
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
      {/* Doc 30: Imprimir gera o PDF só da área de Controle (tabelas), escondendo o resto e as ações. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #controle-print, #controle-print * { visibility: visible; }
          #controle-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          #controle-print table { width: 100%; }
          #controle-print tr { break-inside: avoid; }
        }
      `}</style>

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
            {/* Badge de risco (baixo/médio/alto) removido a pedido do dono (doc 16): o card não exibe
                mais "Risco alto". O cálculo de risco segue existindo para quem precisar. */}
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
          {/* Doc 32: "enviar mensagem" abre o WhatsApp DIRETO (igual ao botão ao lado do telefone no
              cadastro) — não o compositor interno. Usa o telefone do paciente, ou o do responsável. */}
          {(() => {
            const waNum = numeroDoWhatsapp(patient.phone) ?? numeroDoWhatsapp(patient.guardianPhone);
            return (
              <button
                type="button"
                onClick={() => waNum && abrirWhatsapp(`https://wa.me/${waNum}`)}
                disabled={!waNum}
                title={waNum ? "Enviar mensagem no WhatsApp" : "Paciente sem telefone"}
                aria-label="Enviar mensagem no WhatsApp"
                className="shrink-0 p-2.5 rounded-2xl bg-[#25D366]/10 text-[#128C7E] border border-[#25D366]/20 hover:bg-[#25D366]/20 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            );
          })()}
          {/* Doc 42: ao lado do WhatsApp, botões diretos de Telegram e E-mail (compositor da casa,
              já com o canal escolhido). */}
          <MessagePatient patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }} canalInicial="telegram" rotulo="Telegram" icone={Send} />
          <MessagePatient patient={{ id: patient.id, name: patient.name, phone: patient.phone, email: patient.email }} canalInicial="email" rotulo="E-mail" icone={Mail} />
          {/* Doc 33: o 2º ícone (histórico de WhatsApp) e o "Prontuário PDF" foram retirados do card. */}
          {/* Doc 36: no celular, "Editar" ficava EMBAIXO de "Exportar dados" (o flex-wrap do pai
              quebrava entre os dois). Agrupados num flex próprio, ficam SEMPRE lado a lado — o pai
              pode descer o grupo inteiro de linha, mas nunca separar um do outro. */}
          <div className="flex items-center gap-2">
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

      {/* Cards: sessões agendadas · em atraso. A caixinha "Em aberto" saiu a pedido do dono (doc 9):
          o número não comunicava o que media. Os outros indicadores ficam. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/dashboard/agenda" className="glass-card rounded-[20px] p-4 hover:shadow-md transition">
          <p className="text-2xl font-display font-bold text-primary">{sessionStats.agendadasFuturas}</p>
          <p className="text-xs text-foreground/50">Sessões agendadas</p>
        </Link>
        <button onClick={() => setTab("Geral")} title="Cobranças vencidas e ainda não pagas — passou a data de vencimento sem o pagamento ser lançado."
          className={`rounded-[20px] p-4 text-left border transition hover:shadow-md ${finance.nAtraso > 0 ? "bg-[#fef2f2] border-[#fecaca]" : "glass-card border-transparent"}`}>
          <p className={`text-2xl font-display font-bold ${finance.nAtraso > 0 ? "text-[#b91c1c]" : "text-primary"}`}>{finance.nAtraso}</p>
          <p className="text-xs text-foreground/50">Em atraso</p>
          <p className="text-[10px] text-foreground/40">{finance.emAtraso > 0 ? `${formatBRL(finance.emAtraso.toFixed(2))} · vencida` : "—"}</p>
        </button>
        {/* Doc 67: ao lado do Em atraso, o total geral RECEBIDO — tudo que já entrou, em todos os
            anos. É a pergunta "quanto este paciente já me pagou", que nenhum dos outros responde. */}
        <button onClick={() => setTab("Geral")} title="Soma de todos os pagamentos lançados para este paciente, em todos os anos."
          className="glass-card rounded-[20px] p-4 text-left border border-transparent transition hover:shadow-md">
          <p className="text-2xl font-display font-bold text-primary">{formatBRL((finance.totalRecebido ?? 0).toFixed(2))}</p>
          <p className="text-xs text-foreground/50">Total geral</p>
          <p className="text-[10px] text-foreground/40">recebido em todos os anos</p>
        </button>
      </div>

      {/* Doc 41: sessões realizadas (presenças), com detalhe por mês/ano, abaixo das agendadas. */}
      <SessoesRealizadasCard total={sessionStats.realizadasCount} porMes={sessionStats.realizadasPorMes} />

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

      {/* Tabs — Doc 33: no celular os nomes eram cortados; agora a faixa rola na horizontal e cada
          aba não encolhe nem quebra o texto. */}
      <div className="flex flex-wrap gap-2 bg-white/50 p-1.5 rounded-2xl">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t ? "bg-primary text-white" : "text-foreground/60 hover:bg-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Geral (Controle) */}
      {tab === "Geral" && (
        <div id="controle-print" className="space-y-4">
          {/* GER4: cabeçalho do Controle — valor da sessão + próximo reajuste */}
          <div className="glass-card rounded-[24px] p-5 flex flex-wrap items-center justify-between gap-3">
            {/* Doc 65: no financeiro GRATUITO o cabeçalho diz "Gratuito", não o preço guardado.
                O cadastro continua lembrando o último valor combinado (é o que volta se a dona
                trocar o formato de novo), mas mostrá-lo aqui dizia que a sessão custa R$ 50,00
                numa tela que não cobra nada — a paciente que ela viu, com a vigência do avulso já
                apagada. A linha logo abaixo do nome já segue a mesma regra. */}
            <div>
              <p className="text-2xl font-display font-bold text-primary">{cobra(patient.paymentFormat) ? formatBRL(patient.sessionFee) : "Gratuito"}</p>
              <p className="text-xs text-foreground/50">Valor da sessão</p>
            </div>
            {patient.priceReviewDate && (
              /* Doc 41: inativo mostra "estava previsto" (no passado), ativo "previsto". */
              <p className="text-sm font-semibold text-[#92400e] flex items-center gap-1.5">
                ⏰ Reajuste {patient.patientStatus === "inativo" ? "estava previsto" : "previsto"} para {formatDate(patient.priceReviewDate)}
              </p>
            )}
          </div>
          {/* O seletor de ano é ÚNICO e vem ANTES da tabela de Controle (documento de 17/09): uma
              escolha só, e as duas tabelas respondem juntas. Antes o seletor morava dentro da
              tabela de pagamentos, e dava para ler as sessões de um ano com os pagamentos de outro
              na mesma tela, sem nada avisar. Filtrar não altera nem apaga dado: só escolhe o que
              aparece. */}
          {/* Doc 30: opção "TODOS" no filtro + botão Imprimir (gera o PDF das tabelas pelo filtro). */}
          <div className="flex items-center justify-end gap-2 no-print">
            <label htmlFor="ano-do-paciente" className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Ano</label>
            <select
              id="ano-do-paciente"
              value={ano}
              onChange={(e) => setAno(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}
              className="text-sm font-semibold rounded-lg bg-white border border-border px-2.5 py-1.5 outline-none"
            >
              <option value="TODOS">TODOS</option>
              {anosDoPaciente.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg bg-primary text-white px-3 py-1.5 hover:opacity-90 cursor-pointer"
            >
              <FileText className="w-4 h-4" /> Imprimir
            </button>
          </div>
          {/* Títulos para o PDF (doc 30): identificam as tabelas e o paciente/filtro na impressão. */}
          <div className="hidden print:block mb-2">
            <h2 className="text-lg font-bold">Controle Geral — {patient.name}</h2>
            <p className="text-sm text-foreground/60">Ano: {ano === "TODOS" ? "Todos" : ano}</p>
          </div>
          <GeralTab patientId={patient.id} linhas={geral} ano={ano} responsavel={pagador.nome}
            responsavelCpf={pagador.cpf} creditoDisponivel={creditoDisponivel} creditoAConfirmar={creditoAConfirmar}
            cobrar={{ telefone: patient.guardianPhone || patient.phone, nome: patient.guardianName || patient.name, modelo: cobrancaMessage }} />
          {/* GER6: valores recebidos por mês, no MESMO ano escolhido acima (líquido — doc 50) */}
          <TabelaAnual payments={payments} ano={ano} vigencias={vigenciasTaxa} />
        </div>
      )}

      {/* Dados */}
      {/* Registros (ex-Prontuário) */}
      {tab === "Registros" && (
        <div className="space-y-4">
          {/* Cabeçalho do prontuário (etiquetas + observações + histórico) removido a pedido do dono
              (prints 6.pdf, itens 1 e 2): o prontuário fica só com o histórico terapêutico e os
              registros livres. */}
          <AnexosProntuario patientId={patient.id} />

          {/* Doc 33: "Histórico terapêutico" (TreatmentPlan) retirado dos Registros. */}
          <div className="flex flex-wrap gap-4">
            <button onClick={() => setShowRecord((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
              <Plus className="w-4 h-4" /> Novo registro
            </button>
            {/* Doc 33: "+ Anamnese estruturada" saiu — a anamnese agora é uma guia própria. */}
            {transcriptionEnabled && (
              <button onClick={() => setShowTranscribe((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
                <Mic className="w-4 h-4" /> Transcrever sessão (IA)
              </button>
            )}
          </div>


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
              {/* Registro livre (prints 6.pdf, item 7): sem opções de tipo — o profissional registra o
                  que achar interessante. Anamnese tem o botão dedicado acima; nota saiu. */}
              <input type="hidden" name="type" value="registro" />
              <div>
                <label className="text-xs font-semibold text-foreground/60">Título (opcional)</label>
                <input name="title" className={inputCls} placeholder="ex: Sessão 12" />
              </div>
              <textarea name="content" rows={5} required className={inputCls} placeholder="Registro clínico, evolução do paciente, observações da sessão..." />
              <BotaoSalvar>Salvar registro</BotaoSalvar>
            </form>
          )}
          {records.length === 0 ? <Empty text="Nenhum registro no prontuário." /> : (
            <div className="space-y-2">
              {/* Doc 33: cada registro tem ícones de editar (título+descrição) e excluir — ver RegistroItem. */}
              {records.map((r) => (
                <RegistroItem key={r.id} patientId={patient.id} r={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anamnese (doc 33): guia própria, campos com Salvar/Editar individuais + campos custom. */}
      {tab === "Anamnese" && <AnamneseTab patientId={patient.id} campos={anamnese} />}

      {/* Espaço do Paciente: humor + tarefas */}
      {tab === "Atividades" && (
        <>
          <AssignmentsTab patientId={patient.id} assignments={assignments} moodToken={moodToken} moodLogs={moodLogs} scales={scales} activities={activities} />
          {consents.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">✍️ Consentimento assinado</h3>
              <div className="space-y-2">
                {consents.map((c) => (
                  <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                    <div className="font-medium text-gray-700">{c.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {/* Hora de parede: formatar no fuso de cada runtime divergia entre servidor e
                          navegador (erro de hidratação) e mostrava a hora deslocada. */}
                      Assinado por <b>{c.acceptedName}</b> em {formatDateTime(c.acceptedAt)}
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
                      <span>{formatDateTime(e.createdAt)}</span>
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

      {/* Documentos (doc 33): elaboração/impressão/edição de documentos individuais do paciente. */}
      {tab === "Documentos" && docCabecalho && <DocumentosTab patientId={patient.id} cabecalho={docCabecalho} documentos={documentos} />}

    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-foreground/40 py-4 text-center">{text}</p>;
}
