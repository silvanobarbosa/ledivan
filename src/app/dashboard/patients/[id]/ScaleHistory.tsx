"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { SCALES, type ScaleType, severityColor } from "@/lib/scales";

type App = { id: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null };

export function ScaleHistory({ apps }: { apps: App[] }) {
  const types: ScaleType[] = ["phq9", "gad7"];
  const withData = types.filter((t) => apps.some((a) => a.scaleType === t && a.status === "respondida"));
  if (withData.length === 0) return null;

  return (
    <div className="space-y-4">
      {withData.map((t) => {
        const scale = SCALES[t];
        const points = apps
          .filter((a) => a.scaleType === t && a.status === "respondida" && a.score != null)
          .sort((a, b) => new Date(a.appliedAt!).getTime() - new Date(b.appliedAt!).getTime())
          .map((a) => ({ date: new Date(a.appliedAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), score: a.score! }));
        const last = points[points.length - 1];
        const sev = scale.severity(last.score);
        return (
          <div key={t} className="rounded-2xl bg-surface/50 border border-border p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-primary">{scale.short}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityColor(sev.tone)}`}>
                {last.score}/{scale.max} · {sev.label}
              </span>
            </div>
            {points.length >= 2 && (
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7ddd4" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b5b6f" }} />
                    <YAxis domain={[0, scale.max]} tick={{ fontSize: 9, fill: "#6b5b6f" }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7ddd4", fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: "#8b5cf6" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
