"use client";

import { useState, useTransition } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";
import { markReceiptIssued, clearReceipt } from "./actions";

export type ReceiptItem = {
  paymentId: string;
  patientName: string;
  fields: {
    beneficiaryName: string; beneficiaryCpf: string;
    payerName: string; payerCpf: string;
    amountBRL: string; dateBR: string; description: string;
    missing: string[];
  };
  copyText: string;
  issuedAt: string | null;
  receiptNumber: string | null;
};

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* ignore */ }
  };
  return (
    <button type="button" onClick={copy} title={`Copiar ${label}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? "copiado" : "copiar"}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <span className="text-[11px] uppercase tracking-wide text-foreground/40">{label}</span>
        <div className="text-sm text-foreground/80 truncate">{value || "—"}</div>
      </div>
      {value ? <CopyBtn text={value} label={label} /> : null}
    </div>
  );
}

export function ReceiptCard({ item }: { item: ReceiptItem }) {
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState(item.receiptNumber ?? "");
  const [pending, start] = useTransition();
  const f = item.fields;

  const mark = () => start(async () => { await markReceiptIssued(item.paymentId, num); });

  return (
    <div className="glass-card rounded-2xl p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3">
        <div className="text-left">
          <div className="font-semibold text-foreground/90">{item.patientName}</div>
          <div className="text-xs text-foreground/50">{f.amountBRL} · {f.dateBR}</div>
        </div>
        <div className="flex items-center gap-2">
          {f.missing.length > 0 && <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">falta {f.missing.join(", ")}</span>}
          <ChevronDown className={`w-4 h-4 text-foreground/40 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-border/50 bg-white/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Campos para o app Receita Saúde</span>
              <CopyBtn text={item.copyText} label="tudo" />
            </div>
            <Row label="Beneficiário" value={f.beneficiaryName} />
            <Row label="CPF do beneficiário" value={f.beneficiaryCpf} />
            <Row label="Pagador" value={f.payerName} />
            <Row label="CPF do pagador" value={f.payerCpf} />
            <Row label="Valor" value={f.amountBRL} />
            <Row label="Data" value={f.dateBR} />
            <Row label="Descrição" value={f.description} />
          </div>

          <div className="flex items-center gap-2">
            <input
              value={num}
              onChange={(e) => setNum(e.target.value)}
              placeholder="Nº do recibo (opcional)"
              maxLength={60}
              className="flex-1 rounded-xl border border-border/60 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="button" onClick={mark} disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Marcar emitido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IssuedRow({ item }: { item: ReceiptItem }) {
  const [pending, start] = useTransition();
  const undo = () => start(async () => { await clearReceipt(item.paymentId); });
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-white/40 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <span className="font-medium text-foreground/80">{item.patientName}</span>
        <span className="text-foreground/40"> · {item.fields.amountBRL} · {item.fields.dateBR}{item.receiptNumber ? ` · nº ${item.receiptNumber}` : ""}</span>
      </div>
      <button type="button" onClick={undo} disabled={pending} className="text-xs text-foreground/40 hover:text-red-500 disabled:opacity-50">desfazer</button>
    </div>
  );
}
