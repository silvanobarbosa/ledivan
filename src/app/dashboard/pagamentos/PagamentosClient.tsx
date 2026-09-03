"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Send, Check } from "lucide-react";
import { cobrarPaciente, setAutoCobranca } from "./actions";

type Cell = { esperado: number; pago: number; aberto: number };
type Detail = { patientId: string; name: string; esperado: number; pago: number; aberto: number };
type PayLite = { patientId: string; ym: string; amount: number; method: string };

const MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const METODO: Record<string, string> = { pix: "Pix", card: "Cartão", transfer: "Transferência", cash: "Dinheiro" };

export function PagamentosClient({ year, months, totals, perMonthDetail, patients, payments, currentMonth, autoCobranca }: {
  year: number; months: string[]; totals: Cell[]; perMonthDetail: Detail[][];
  patients: { id: string; name: string }[]; payments: PayLite[]; currentMonth: number; autoCobranca: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(currentMonth >= 0 ? currentMonth : null);
  const [selPatient, setSelPatient] = useState(patients[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [auto, setAuto] = useState(autoCobranca);

  const totalAno = useMemo(() => totals.reduce((a, c) => ({ esperado: a.esperado + c.esperado, pago: a.pago + c.pago, aberto: a.aberto + c.aberto }), { esperado: 0, pago: 0, aberto: 0 }), [totals]);

  const cobrar = (d: Detail, mesIdx: number) => start(async () => {
    const r = await cobrarPaciente(d.patientId, d.aberto, mesIdx);
    if (r.ok) setSent((s) => ({ ...s, [`${mesIdx}-${d.patientId}`]: true }));
    else alert(r.error || "Falha ao enviar cobrança.");
  });

  // Quadro 1: recebido por mês do paciente selecionado + info
  const receivedRows = useMemo(() => {
    const rec = Array(12).fill(0);
    const info: string[][] = Array.from({ length: 12 }, () => []);
    for (const p of payments) {
      if (p.patientId !== selPatient) continue;
      const m = Number(p.ym.split("-")[1]) - 1;
      if (m < 0 || m > 11) continue;
      rec[m] += p.amount;
      info[m].push(METODO[p.method] || p.method || "—");
    }
    return MES.map((label, i) => ({ label, valor: rec[i], info: [...new Set(info[i])].join(", ") }));
  }, [payments, selPatient]);
  const total1 = receivedRows.reduce((a, r) => a + r.valor, 0);

  const yearOpts = [year - 1, year, year + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/50">Ano:</span>
          <select value={year} onChange={(e) => router.push(`/dashboard/pagamentos?year=${e.target.value}`)} className="px-3 py-1.5 rounded-xl bg-surface border border-border text-sm outline-none">
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer bg-surface rounded-xl px-3 py-1.5 border border-border">
          <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); start(async () => { await setAutoCobranca(e.target.checked); }); }} className="accent-primary w-4 h-4" />
          Cobrança automática mensal
        </label>
      </div>

      {/* QUADRO 2 — por mês, todos os pacientes */}
      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        <h3 className="font-display text-lg font-bold text-primary mb-3">Por mês — todos os pacientes</h3>
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
              <th className="py-2">Mês</th><th className="py-2 text-right">Esperado</th><th className="py-2 text-right">Pago</th><th className="py-2 text-right">Em aberto</th><th className="py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {totals.map((c, i) => {
              const det = perMonthDetail[i] ?? [];
              const abertos = det.filter((d) => d.aberto > 0.005);
              return (
                <Fragment key={i}>
                  <tr className={`border-b border-border/40 ${i === currentMonth ? "bg-primary/5" : ""}`}>
                    <td className="py-2 font-medium">{MES[i]}</td>
                    <td className="py-2 text-right">{brl(c.esperado)}</td>
                    <td className="py-2 text-right text-emerald-600">{brl(c.pago)}</td>
                    <td className="py-2 text-right text-red-600">{c.aberto > 0.005 ? brl(c.aberto) : "—"}</td>
                    <td className="py-2 text-right">
                      {det.length > 0 && <button onClick={() => setOpen(open === i ? null : i)} className="text-foreground/40 hover:text-primary"><ChevronDown className={`w-4 h-4 transition ${open === i ? "rotate-180" : ""}`} /></button>}
                    </td>
                  </tr>
                  {open === i && det.length > 0 && (
                    <tr><td colSpan={5} className="bg-surface/40 px-3 py-2">
                      <div className="space-y-1.5">
                        {det.map((d) => (
                          <div key={d.patientId} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="flex-1 truncate">{d.name}</span>
                            <span className="text-foreground/50 w-24 text-right">{brl(d.esperado)}</span>
                            <span className="text-emerald-600 w-24 text-right">{brl(d.pago)}</span>
                            <span className={`w-24 text-right font-semibold ${d.aberto > 0.005 ? "text-red-600" : "text-foreground/30"}`}>{d.aberto > 0.005 ? brl(d.aberto) : "—"}</span>
                            <span className="w-24 text-right">
                              {d.aberto > 0.005 && (
                                sent[`${i}-${d.patientId}`]
                                  ? <span className="text-emerald-600 inline-flex items-center gap-1 text-xs"><Check className="w-3.5 h-3.5" /> enviado</span>
                                  : <button disabled={pending} onClick={() => cobrar(d, i)} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1 hover:bg-primary/20 disabled:opacity-50"><Send className="w-3 h-3" /> Cobrar</button>
                              )}
                            </span>
                          </div>
                        ))}
                        {abertos.length > 1 && (
                          <div className="pt-1 text-right">
                            <button disabled={pending} onClick={() => abertos.forEach((d) => cobrar(d, i))} className="text-xs text-primary hover:underline disabled:opacity-50">Cobrar todos em aberto ({abertos.length})</button>
                          </div>
                        )}
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t border-border">
              <td className="py-2">Total {year}</td>
              <td className="py-2 text-right">{brl(totalAno.esperado)}</td>
              <td className="py-2 text-right text-emerald-600">{brl(totalAno.pago)}</td>
              <td className="py-2 text-right text-red-600">{brl(totalAno.aberto)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="text-[11px] text-foreground/40 mt-2">Meses futuros já contam as reservas/agendamentos da agenda. Cobrança vai pelo seu WhatsApp.</p>
      </div>

      {/* QUADRO 1 — por paciente, mês a mês (estilo planilha) */}
      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-display text-lg font-bold text-primary">Por paciente — mês a mês</h3>
          <select value={selPatient} onChange={(e) => setSelPatient(e.target.value)} className="px-3 py-1.5 rounded-xl bg-surface border border-border text-sm outline-none">
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
              <th className="py-2">Mês</th><th className="py-2 text-right">Valores recebidos</th><th className="py-2">Informações sobre o pagamento</th>
            </tr>
          </thead>
          <tbody>
            {receivedRows.map((r) => (
              <tr key={r.label} className="border-b border-border/40">
                <td className="py-2 font-medium">{r.label}</td>
                <td className="py-2 text-right">{r.valor > 0 ? brl(r.valor) : "—"}</td>
                <td className="py-2 text-foreground/50">{r.info || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t border-border"><td className="py-2">Total</td><td className="py-2 text-right">{brl(total1)}</td><td /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
