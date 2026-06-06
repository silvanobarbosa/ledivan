"use client";

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Pt = { label: string; count: number };
type Slice = { name: string; value: number };

const tip = { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e7ddd4", fontSize: "12px" } as const;
const MODE_COLORS = ["#8b5cf6", "#047857"];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-[28px] p-6 space-y-3">
      <h3 className="font-display text-lg font-bold text-primary">{title}</h3>
      <div className="h-60 w-full">{children}</div>
    </div>
  );
}
function Empty() { return <div className="h-full flex items-center justify-center text-sm text-foreground/40">Sem dados no período.</div>; }

export function AnaliticosCharts({ monthly, weekday, mode }: { monthly: Pt[]; weekday: Pt[]; mode: Slice[] }) {
  const hasM = monthly.some((m) => m.count > 0);
  const hasMode = mode.some((m) => m.value > 0);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card title="Atendimentos por mês">
        {hasM ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
              <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tip} />
              <Line type="monotone" dataKey="count" name="Atendimentos" stroke="#2b1830" strokeWidth={3} dot={{ r: 3, fill: "#8b5cf6" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Online × Presencial">
        {hasMode ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mode.filter((m) => m.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {mode.filter((m) => m.value > 0).map((m, i) => <Cell key={i} fill={MODE_COLORS[mode.findIndex((x) => x.name === m.name) % MODE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Por dia da semana">
        {hasM ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekday} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
              <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" name="Atendimentos" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>

      <Card title="Volume mensal (barras)">
        {hasM ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
              <XAxis dataKey="label" tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#9b8aa0", fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tip} />
              <Bar dataKey="count" name="Atendimentos" fill="#2b1830" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Card>
    </div>
  );
}
