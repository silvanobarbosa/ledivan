"use client";

import { useState } from "react";
import { createSession } from "../../sessions/actions";
import { createPayment } from "../../payments/actions";
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
} from "@/lib/therapy";
import { Phone, Mail, MapPin, Plus, Link2 } from "lucide-react";

type Patient = {
  id: string; name: string; email: string | null; phone: string | null;
  sessionFee: string; frequency: string | null; notes: string | null;
  patientStatus: string; paymentStatus: string; startedAt: string | null; address: string | null;
  emergencyName: string | null; emergencyPhone: string | null; emergencyRelationship: string | null;
  contractType: string | null; paymentDay: number | null;
};
type Session = { id: string; date: string; duration: number; fee: string; status: string; notes: string | null };
type Payment = { id: string; date: string; amount: string; method: string; status: string; linkedTransactionId: string | null };
type StatusEntry = { id: string; status: string; date: string };
type PriceEntry = { id: string; valor: string; dataEfetiva: string };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const TABS = ["Dados", "Sessões", "Pagamentos", "Histórico"] as const;

export function PatientDetail({
  patient, sessions, payments, statusHistory, priceHistory, autoLinkPayments,
}: {
  patient: Patient; sessions: Session[]; payments: Payment[];
  statusHistory: StatusEntry[]; priceHistory: PriceEntry[]; autoLinkPayments: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dados");
  const [showSession, setShowSession] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

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
          </div>
          <p className="text-foreground/50 mt-1">
            {patient.frequency || "—"} · {formatBRL(patient.sessionFee)}/sessão · {patient.contractType}
          </p>
          <div className="flex gap-4 mt-3 text-sm text-foreground/60 flex-wrap">
            {patient.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{patient.phone}</span>}
            {patient.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{patient.email}</span>}
          </div>
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
              <div className="sm:col-span-2"><label className="text-xs font-semibold text-foreground/60">Status</label>
                <select name="status" className={inputCls} defaultValue="agendada">
                  {Object.entries(SESSION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div className="sm:col-span-2"><textarea name="notes" rows={2} placeholder="Notas da sessão" className={inputCls} /></div>
              <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar sessão</button>
            </form>
          )}
          {sessions.length === 0 ? <Empty text="Nenhuma sessão registrada." /> : (
            <div className="grid gap-2">
              {sessions.map((s) => (
                <div key={s.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{formatDateTime(s.date)}</p>
                    <p className="text-sm text-foreground/50">{s.duration}min · {formatBRL(s.fee)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${sessionStatusColor(s.status)}`}>
                    {SESSION_STATUS_LABELS[s.status]}
                  </span>
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
              </label>
              <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar pagamento</button>
            </form>
          )}
          {payments.length === 0 ? <Empty text="Nenhum pagamento registrado." /> : (
            <div className="grid gap-2">
              {payments.map((p) => (
                <div key={p.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
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
                </div>
              ))}
            </div>
          )}
        </div>
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
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3">Preço</p>
            {priceHistory.length === 0 ? <Empty text="Sem histórico." /> : priceHistory.map((h) => (
              <div key={h.id} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                <span>{formatBRL(h.valor)}</span><span className="text-foreground/40">{formatDate(h.dataEfetiva)}</span>
              </div>
            ))}
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
