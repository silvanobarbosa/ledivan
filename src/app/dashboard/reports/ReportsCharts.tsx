"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

type Monthly = { label: string; income: number; expense: number; net: number; cumulative: number };
type Slice = { name: string; value: number; color?: string | null };

const PALETTE = ["#2b1830", "#8b5cf6", "#c4b5fd", "#6b5b6f", "#b45309", "#047857", "#0ea5e9", "#b91c1c"];
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
const tip = { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e7ddd4", fontSize: "12px" } as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-[28px] p-6 space-y-3">
      <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function ReportsCharts({ monthly, categories, sources }: { monthly: Monthly[]; categories: Slice[]; sources: Slice[] }) {
  const hasMonthly = monthly.length > 0;
  const cats = categories.filter((c) => c.value > 0).map((c, i) => ({ ...c, color: c.color || PALETTE[i % PALETTE.length] }));
  const srcs = sources.filter((s) => s.value > 0);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="Receitas × Despesas por mês">
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
              <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tip} formatter={(v: any) => brl(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Receita" fill="#047857" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesa" fill="#b91c1c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Saldo acumulado">
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
              <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tip} formatter={(v: any) => brl(Number(v))} />
              <Area type="monotone" dataKey="cumulative" name="Saldo acumulado" stroke="#2b1830" strokeWidth={2} fill="url(#cum)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Despesas por categoria">
        {cats.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={cats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {cats.map((c, i) => <Cell key={i} fill={c.color!} />)}
              </Pie>
              <Tooltip contentStyle={tip} formatter={(v: any) => brl(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Receitas por origem">
        {srcs.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={srcs} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7ddd4" />
              <XAxis type="number" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#6b5b6f", fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={tip} formatter={(v: any) => brl(Number(v))} />
              <Bar dataKey="value" name="Receita" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>
    </div>
  );
}

function Empty() {
  return <div className="h-full flex items-center justify-center text-sm text-foreground/40">Sem dados no período.</div>;
}
