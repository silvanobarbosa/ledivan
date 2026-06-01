"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Mood = { id: string; mood: number; note: string | null; loggedAt: string };
const EMOJI = ["", "😣", "😕", "😐", "🙂", "😄"];

export function MoodChart({ logs }: { logs: Mood[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-foreground/40 py-2">Sem registros de humor ainda.</p>;
  }

  // ordem cronológica para o gráfico
  const data = [...logs].reverse().map((l) => ({
    date: new Date(l.loggedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    mood: l.mood,
  }));

  const avg = (logs.reduce((a, l) => a + l.mood, 0) / logs.length).toFixed(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/60">{logs.length} registro(s) · média {avg} {EMOJI[Math.round(Number(avg))]}</p>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7ddd4" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b5b6f" }} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "#6b5b6f" }} />
            <Tooltip
              formatter={(value) => {
                const v = Number(value);
                return [`${EMOJI[v] ?? ""} ${v}/5`, "Humor"];
              }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e7ddd4", fontSize: 12 }}
            />
            <Line type="monotone" dataKey="mood" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: "#8b5cf6" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
        {logs.slice(0, 8).map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm">
            <span className="text-lg">{EMOJI[l.mood]}</span>
            <span className="text-foreground/40 text-xs w-20 shrink-0">{new Date(l.loggedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            {l.note && <span className="text-foreground/70 truncate">{l.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
