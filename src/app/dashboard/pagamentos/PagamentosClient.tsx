"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PorMesCadastros } from "./PorMesCadastros";

type PayLite = { patientId: string; ym: string; amount: number; method: string };

const MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const METODO: Record<string, string> = { pix: "Pix", card: "Cartão", transfer: "Transferência", cash: "Dinheiro" };

export function PagamentosClient({ year, patients, payments }: {
  year: number;
  patients: { id: string; name: string }[];
  payments: PayLite[];
}) {
  const router = useRouter();
  const [selPatient, setSelPatient] = useState(patients[0]?.id ?? "");

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
      </div>

      {/* QUADRO 2 — por mês, todos os cadastros (doc 46): reformulado sobre o motor da guia Geral,
          com ID/Vencimento/Atrasado/Em aberto/Pago/Cobrar/Cobranças enviadas + cards de resumo. */}
      <PorMesCadastros year={year} />

      {/* QUADRO 1 — por paciente, mês a mês (estilo planilha) */}
      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-display text-lg font-bold text-primary">Por cadastro — mês a mês</h3>
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
