"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { editPriceHistory, deletePriceHistory } from "../actions";
import { formatBRL, formatDate } from "@/lib/therapy";

type PriceEntry = { id: string; valor: string; dataEfetiva: string };
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };

// Histórico financeiro (valor + recorrência/modelo). Edição de valor/data inline.
// O ajuste em si (valor/recorrência/pacote) é feito no CADASTRO do paciente.
export function FinanceAdjust({
  priceHistory, contractHistory,
}: {
  patientId?: string;
  frequency?: string | null;
  priceHistory: PriceEntry[];
  contractHistory: ContractEntry[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const recHist = contractHistory.filter((h) => h.type === "recorrencia" || h.type === "model");

  return (
    <div className="glass-card rounded-[24px] p-5 space-y-4">
      <div>
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Histórico de valor</p>
        {priceHistory.length === 0 ? <p className="text-sm text-foreground/40">Sem histórico.</p> : priceHistory.map((h) => (
          editId === h.id ? (
            <form key={h.id} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { await editPriceHistory(h.id, fd); setEditId(null); router.refresh(); }); }} className="flex items-center gap-2 py-1.5">
              <input name="valor" inputMode="decimal" defaultValue={h.valor} className="w-28 px-2 py-1.5 rounded-lg bg-white border border-border text-sm" />
              <input name="dataEfetiva" type="date" defaultValue={h.dataEfetiva.slice(0, 10)} className="px-2 py-1.5 rounded-lg bg-white border border-border text-sm" />
              <button disabled={pending} className="text-[#047857]"><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => setEditId(null)} className="text-foreground/40"><X className="w-4 h-4" /></button>
            </form>
          ) : (
            <div key={h.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border last:border-0 group">
              <span>{formatBRL(h.valor)}</span>
              <span className="flex items-center gap-2">
                <span className="text-foreground/40">{formatDate(h.dataEfetiva)}</span>
                <button onClick={() => setEditId(h.id)} className="text-foreground/30 hover:text-primary opacity-0 group-hover:opacity-100 transition"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => start(async () => { await deletePriceHistory(h.id); router.refresh(); })} className="text-foreground/30 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </span>
            </div>
          )
        ))}
      </div>

      {recHist.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Histórico de recorrência / modelo</p>
          {recHist.map((h) => (
            <div key={h.id} className="flex justify-between py-1 text-sm border-b border-border last:border-0">
              <span>{h.description || `${h.from} → ${h.to}`}</span>
              <span className="text-foreground/40">{formatDate(h.date)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-foreground/40">💡 Para alterar valor, recorrência, formato ou pacote, edite o <strong>cadastro</strong> do paciente.</p>
    </div>
  );
}
