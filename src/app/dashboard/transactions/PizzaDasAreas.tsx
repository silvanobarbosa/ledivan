"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRL } from "@/lib/therapy";
import { numeroDoTooltip, type ValorTooltip } from "@/lib/chart";
import { type AreaDoCaixa } from "@/lib/areasDoCaixa";

export type Fatia = { area: AreaDoCaixa; rotulo: string; valor: number; cor: string };

/**
 * A pizza abaixo do extrato (doc 64): sessões, supervisões, receitas e despesas pessoais, lado a
 * lado, no mesmo recorte da tela.
 *
 * Ela lê as linhas do extrato já filtradas — nunca uma consulta própria. O valor de cada fatia é o
 * LÍQUIDO efetivado, com o estorno abatendo a área de onde saiu.
 */
export function PizzaDasAreas({ fatias, rotulo }: { fatias: Fatia[]; rotulo: string }) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  if (!fatias.length) {
    return <p className="text-xs text-foreground/40">Sem valores para comparar no período ({rotulo.toLowerCase()}).</p>;
  }

  return (
    <div className="rounded-2xl bg-white/50 border border-border p-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h4 className="font-display font-bold text-primary">Comparativo por área</h4>
        <span className="text-xs text-foreground/50">{rotulo} · total {formatBRL(total)}</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* A legenda abaixo já nomeia as fatias; rótulo em cima delas, com quatro áreas, só
                empilha texto. O nome aparece no toque/hover, pelo `nameKey`. */}
            <Pie data={fatias} dataKey="valor" nameKey="rotulo" cx="50%" cy="50%" outerRadius={88}>
              {fatias.map((f) => <Cell key={f.area} fill={f.cor} />)}
            </Pie>
            <Tooltip formatter={(v: ValorTooltip) => formatBRL(numeroDoTooltip(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* A leitura em números, para quem confere com a tabela acima — e para quem imprime. */}
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {fatias.map((f) => (
          <li key={f.area} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.cor }} aria-hidden />
              {f.rotulo}
            </span>
            <span className="tabular-nums font-semibold">{formatBRL(f.valor)} <span className="text-foreground/40">({total > 0 ? Math.round((f.valor / total) * 100) : 0}%)</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
