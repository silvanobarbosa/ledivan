"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PorMesCadastros } from "./PorMesCadastros";
import { recebidoPorForma } from "@/lib/recebidoPorForma";
import { type VigenciaTaxa } from "@/lib/taxaCartao";
import { formatBRL } from "@/lib/therapy";

type PayLite = { patientId: string; ym: string; data: string; amount: number; method: string };

const MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function PagamentosClient({ year, patients, payments, vigencias }: {
  year: number;
  patients: { id: string; name: string }[];
  payments: PayLite[];
  vigencias: VigenciaTaxa[];
}) {
  const router = useRouter();
  const [selPatient, setSelPatient] = useState(patients[0]?.id ?? "");

  // Quadro 1 (doc 50): só Mês + Valores recebidos. "Valores recebidos" = recebido por forma
  // (R$ bruto <forma>, com "Líquido R$ y" no débito/crédito). O total do ano soma os LÍQUIDOS.
  const linhas = useMemo(() => {
    const porMes: PayLite[][] = Array.from({ length: 12 }, () => []);
    for (const p of payments) {
      if (p.patientId !== selPatient) continue;
      const m = Number(p.ym.split("-")[1]) - 1;
      if (m < 0 || m > 11) continue;
      porMes[m].push(p);
    }
    return MES.map((label, i) => ({ label, recebido: recebidoPorForma(porMes[i].map((p) => ({ valor: p.amount, metodo: p.method, data: p.data })), vigencias) }));
  }, [payments, selPatient, vigencias]);
  const totalLiquidoAno = linhas.reduce((a, l) => a + l.recebido.totalLiquido, 0);

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

      {/* QUADRO 2 — "Por mês — todos os cadastros" (abaixo dos cards de resumo do ano). */}
      <PorMesCadastros year={year} />

      {/* QUADRO 1 — por cadastro, mês a mês (doc 50: só Mês + Valores recebidos). */}
      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-display text-lg font-bold text-primary">Por cadastro — mês a mês</h3>
          <select value={selPatient} onChange={(e) => setSelPatient(e.target.value)} className="px-3 py-1.5 rounded-xl bg-surface border border-border text-sm outline-none">
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <table className="w-full text-sm min-w-[360px]">
          <thead>
            {/* Doc 50: títulos centralizados. */}
            <tr className="text-center text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
              <th className="py-2 text-center">Mês</th><th className="py-2 text-center">Valores recebidos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.label} className="border-b border-border/40 align-top">
                <td className="py-2 font-medium">{l.label}</td>
                <td className="py-2">
                  {l.recebido.formas.length === 0 ? <span className="text-foreground/30">—</span> : (
                    <div className="space-y-0.5">
                      {l.recebido.formas.map((f) => (
                        <div key={f.metodo} className="text-foreground/80">
                          {formatBRL(f.bruto)} {f.curto}
                          {f.temTaxa && <span className="text-foreground/50"> — Líquido {formatBRL(f.liquido)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t border-border"><td className="py-2">Total</td><td className="py-2">{formatBRL(totalLiquidoAno)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
