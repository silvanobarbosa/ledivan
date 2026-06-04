"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

interface ChartData {
  date: string;
  total: string | null;
}

export function TransactionsChart({ data }: { data: ChartData[] }) {
  const formattedData = data.map(d => ({
    ...d,
    amount: parseFloat(d.total || "0")
  }));

  if (formattedData.length === 0) {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-center gap-2 text-foreground/40">
        <span className="text-4xl">📈</span>
        <p className="text-sm font-medium">Sem lançamentos nos últimos 30 dias.</p>
        <p className="text-xs">Registre transações ou pagamentos para ver a evolução aqui.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ddd4" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9b8aa0", fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            hide
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              border: "1px solid #e7ddd4",
              boxShadow: "0 10px 15px -3px rgba(43, 24, 48, 0.1)"
            }}
            labelStyle={{ fontWeight: "bold", color: "#2b1830", marginBottom: "4px" }}
            itemStyle={{ color: "#1a0f1f", fontSize: "12px" }}
            formatter={(value: any) => [`R$ ${Number(value || 0).toFixed(2)}`, "Total"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#2b1830"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAmount)"
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
