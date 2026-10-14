"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { matrizFinanceira, type PacienteFin, type SituacaoFiltro } from "@/lib/matrizFinanceira";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SITUACOES: { v: SituacaoFiltro; r: string }[] = [
  { v: "todos", r: "Todos" },
  { v: "pagos", r: "Pagos" },
  { v: "aberto", r: "Em aberto" },
  { v: "atraso", r: "Em atraso" },
];
const brl = (n: number) => (n > 0.005 ? formatBRL(n) : "—");

export function RelatorioFinanceiro({ pacientes }: { pacientes: PacienteFin[] }) {
  // `anos` sai do próprio cálculo; começa no mais recente, ou no ano corrente se não houver dados.
  const anosBase = useMemo(() => matrizFinanceira(pacientes, 0, "todos").anos, [pacientes]);
  const [situacao, setSituacao] = useState<SituacaoFiltro>("todos");
  const [ano, setAno] = useState<number>(anosBase[0] ?? new Date().getFullYear());

  const m = useMemo(() => matrizFinanceira(pacientes, ano, situacao), [pacientes, ano, situacao]);

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-[24px] p-5 flex flex-wrap items-end gap-4 no-print">
        <div>
          <span className="text-[11px] font-semibold text-foreground/60 block mb-1">Situação do pagamento</span>
          <div className="inline-flex rounded-xl overflow-hidden border border-border">
            {SITUACOES.map((s) => (
              <button key={s.v} type="button" onClick={() => setSituacao(s.v)}
                className={`px-3 py-2 text-sm font-bold transition ${situacao === s.v ? "bg-primary text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                {s.r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-foreground/60 block mb-1">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="px-3 py-2 rounded-xl bg-white border border-border text-sm">
            {(anosBase.length ? anosBase : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-primary border border-border rounded-xl px-4 py-2 hover:bg-surface cursor-pointer">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      <div className="glass-card rounded-[24px] p-5 overflow-x-auto">
        {m.linhas.length === 0 ? (
          <p className="text-sm text-foreground/40 py-6 text-center">Nenhum valor para esta situação em {ano}.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-foreground/50">
                <th className="px-2 py-2 text-left font-bold sticky left-0 bg-surface">Paciente</th>
                {MESES.map((mes) => <th key={mes} className="px-2 py-2 text-right font-bold tabular-nums">{mes}</th>)}
                <th className="px-2 py-2 text-right font-bold tabular-nums">Total</th>
              </tr>
            </thead>
            <tbody>
              {m.linhas.map((l) => (
                <tr key={l.id} className="border-b border-border/60">
                  <td className="px-2 py-2 font-medium sticky left-0 bg-white truncate max-w-[180px]" title={l.nome}>{l.nome}</td>
                  {l.meses.map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums text-foreground/70">{brl(v)}</td>)}
                  <td className="px-2 py-2 text-right tabular-nums font-bold">{brl(l.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="px-2 py-2 text-left sticky left-0 bg-surface">Total mensal</td>
                {m.totalMes.map((v, i) => <td key={i} className="px-2 py-2 text-right tabular-nums">{brl(v)}</td>)}
                <td className="px-2 py-2 text-right tabular-nums text-primary">{brl(m.totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
