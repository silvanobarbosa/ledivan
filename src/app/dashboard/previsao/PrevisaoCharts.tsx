"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

type MonthRow = { ym: string; label: string; agendado: number; pacotes: number; recorrencia: number; reajuste: number; total: number };
type Sub = { agendado: number; pacotes: number; recorrencia: number; reajuste: number; total: number };
type Forecast = { months: MonthRow[]; subtotals: Sub };
type PerPatient = { id: string; name: string; total: number; sub: Sub };

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brl0 = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const tip = { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e7ddd4", fontSize: "12px" } as const;

const BUCKETS = [
  { key: "agendado", label: "Agendado", color: "#047857", desc: "Sessões já marcadas (sem pacote)." },
  { key: "pacotes", label: "Pacotes a receber", color: "#8b5cf6", desc: "Sessões de pacote marcadas." },
  { key: "recorrencia", label: "Recorrência projetada", color: "#0ea5e9", desc: "Esperado da recorrência além do marcado." },
  { key: "reajuste", label: "Reajustes", color: "#b45309", desc: "Acréscimo de reajustes futuros." },
] as const;

export function PrevisaoCharts({ forecast, perPatient }: { forecast: Forecast; perPatient: PerPatient[] }) {
  const { months, subtotals } = forecast;
  const hasData = subtotals.total > 0;

  return (
    <div className="space-y-6">
      {/* Cards de subtotal por balde + total */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {BUCKETS.map((b) => (
          <div key={b.key} className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
              <span className="text-xs font-bold uppercase tracking-wide text-foreground/50">{b.label}</span>
            </div>
            <p className="text-lg font-display font-bold mt-1" style={{ color: b.color }}>{brl0(subtotals[b.key])}</p>
            <p className="text-[11px] text-foreground/40 mt-0.5">{b.desc}</p>
          </div>
        ))}
        <div className="glass-card rounded-2xl p-4 bg-primary/5 border border-primary/15">
          <span className="text-xs font-bold uppercase tracking-wide text-primary/60">Total previsto</span>
          <p className="text-lg font-display font-bold mt-1 text-primary">{brl0(subtotals.total)}</p>
          <p className="text-[11px] text-foreground/40 mt-0.5">{months.length} meses</p>
        </div>
      </div>

      {/* Barra empilhada por mês */}
      <div className="glass-card rounded-[28px] p-6 space-y-3">
        <h3 className="font-display text-lg font-bold text-primary">Previsão por mês</h3>
        <div className="h-72 w-full">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
                <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tip} formatter={(v: any) => brl(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {BUCKETS.map((b) => (
                  <Bar key={b.key} dataKey={b.key} name={b.label} stackId="f" fill={b.color} radius={b.key === "reajuste" ? [6, 6, 0, 0] : undefined as never} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-foreground/40 text-sm">Sem sessões futuras ou recorrências para projetar.</div>
          )}
        </div>
      </div>

      {/* Tabela mês a mês */}
      {hasData && (
        <div className="glass-card rounded-[28px] p-6 overflow-x-auto">
          <h3 className="font-display text-lg font-bold text-primary mb-3">Detalhe por mês</h3>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
                <th className="py-2">Mês</th>
                {BUCKETS.map((b) => <th key={b.key} className="py-2 text-right">{b.label}</th>)}
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="font-variant-numeric-tabular">
              {months.map((m) => (
                <tr key={m.ym} className="border-b border-border/40">
                  <td className="py-2 capitalize">{m.label}</td>
                  <td className="py-2 text-right">{brl0(m.agendado)}</td>
                  <td className="py-2 text-right">{brl0(m.pacotes)}</td>
                  <td className="py-2 text-right">{brl0(m.recorrencia)}</td>
                  <td className="py-2 text-right">{brl0(m.reajuste)}</td>
                  <td className="py-2 text-right font-bold text-primary">{brl0(m.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{brl0(subtotals.agendado)}</td>
                <td className="py-2 text-right">{brl0(subtotals.pacotes)}</td>
                <td className="py-2 text-right">{brl0(subtotals.recorrencia)}</td>
                <td className="py-2 text-right">{brl0(subtotals.reajuste)}</td>
                <td className="py-2 text-right text-primary">{brl0(subtotals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Por paciente */}
      {perPatient.length > 0 && (
        <div className="glass-card rounded-[28px] p-6 overflow-x-auto">
          <h3 className="font-display text-lg font-bold text-primary mb-3">Previsão por paciente ({months.length} meses)</h3>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
                <th className="py-2">Paciente</th>
                {BUCKETS.map((b) => <th key={b.key} className="py-2 text-right">{b.label}</th>)}
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {perPatient.map((p) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right">{brl0(p.sub.agendado)}</td>
                  <td className="py-2 text-right">{brl0(p.sub.pacotes)}</td>
                  <td className="py-2 text-right">{brl0(p.sub.recorrencia)}</td>
                  <td className="py-2 text-right">{brl0(p.sub.reajuste)}</td>
                  <td className="py-2 text-right font-bold text-primary">{brl0(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
