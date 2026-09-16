"use client";

import { useState } from "react";
import { formatBRL } from "@/lib/therapy";
import { anosComPagamento, recebidosPorAno } from "@/lib/tabelaAnual";

/**
 * A tabela de valores recebidos por mês, DENTRO do paciente e filtrada por ANO (dono, 16/09/2026) —
 * a mesma do consolidado, mas aqui o filtro é o ano, já que o paciente é um só.
 */
export function TabelaAnual({ payments }: { payments: { id: string; amount: string; date: string; status: string }[] }) {
  const anos = anosComPagamento(payments);
  const opcoes = anos.length ? anos : [new Date().getFullYear()];
  const [ano, setAno] = useState(opcoes[0]);
  const { meses, total } = recebidosPorAno(payments, ano);

  return (
    <div className="glass-card rounded-[24px] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Valores recebidos</p>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="text-sm font-semibold rounded-lg bg-white border border-border px-2.5 py-1.5 outline-none">
          {opcoes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-foreground/40">
            <th className="px-3 py-2 font-bold">Mês</th>
            <th className="px-3 py-2 font-bold text-right">Valor recebido</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes} className="border-t border-border">
              <td className="px-3 py-1.5">{m.mes}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${m.valor > 0 ? "" : "text-foreground/30"}`}>{m.valor > 0 ? formatBRL(m.valor) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-bold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-primary">{formatBRL(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
