"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from "recharts";
import { Loader2, Sparkles } from "lucide-react";

interface Insight {
  id: string;
  type: "positive" | "warning" | "tip";
  content: string;
}

interface CategoryData {
  name: string;
  value: string | null;
  color: string | null;
}

export function CapiInsights({ 
  categoryData = [],
  userId
}: { 
  categoryData?: CategoryData[];
  userId: string;
}) {
  const [insights, setInsights] = useState<Insight[]>([
    { id: "1", type: "tip", content: "Clique no botão abaixo para a IA analisar seus lançamentos." },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const PALETTE = ["#2b1830", "#8b5cf6", "#c4b5fd", "#6b5b6f", "#b45309", "#047857"];
  const data = categoryData.map((c, i) => ({
    name: c.name,
    value: parseFloat(c.value || "0"),
    color: c.color || PALETTE[i % PALETTE.length]
  })).filter(c => c.value > 0);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (result.insights) {
        setInsights(result.insights.map((insight: any, idx: number) => ({
          ...insight,
          id: `ai-${idx}`
        })));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white rounded-[40px] shadow-sm border border-border space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Insights</h3>
        <Sparkles className="w-5 h-5 text-accent" />
      </div>

      {data.length === 0 ? (
        <div className="h-48 w-full flex flex-col items-center justify-center text-center gap-2 text-foreground/40">
          <span className="text-3xl">🍩</span>
          <p className="text-sm font-medium">Sem despesas por categoria ainda.</p>
        </div>
      ) : (
        <>
          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`R$ ${Number(value || 0).toFixed(2)}`, "Total"]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e7ddd4', boxShadow: '0 4px 6px -1px rgb(43 24 48 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">Gastos</span>
              <span className="text-xs font-bold text-primary">Mix</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/60">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="space-y-4">
        {insights.map((insight) => (
          <div 
            key={insight.id}
            className={cn(
              "p-4 rounded-2xl flex gap-3 text-sm transition-all animate-in fade-in slide-in-from-bottom-2",
              insight.type === "warning" && "bg-red-50 text-red-900",
              insight.type === "tip" && "bg-primary/5 text-primary",
              insight.type === "positive" && "bg-green-50 text-green-900"
            )}
          >
            <div className="shrink-0">
              {insight.type === "warning" && "⚠️"}
              {insight.type === "tip" && "💡"}
              {insight.type === "positive" && "🏆"}
            </div>
            <p className="font-medium leading-relaxed italic">{insight.content}</p>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-border">
        <button 
          onClick={generateInsights}
          disabled={isLoading}
          className="w-full py-4 flex items-center justify-center gap-2 text-sm font-bold text-primary bg-secondary/30 rounded-2xl hover:bg-secondary/50 transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Análise Personalizada</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
