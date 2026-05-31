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

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#004D40" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#004D40" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#9CA3AF", fontSize: 12, fontWeight: 600 }}
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
              border: "1px solid #E5E7EB",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
            }}
            labelStyle={{ fontWeight: "bold", color: "#004D40", marginBottom: "4px" }}
            itemStyle={{ color: "#111111", fontSize: "12px" }}
            formatter={(value: any) => [`R$ ${Number(value || 0).toFixed(2)}`, "Total"]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#004D40"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorAmount)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
