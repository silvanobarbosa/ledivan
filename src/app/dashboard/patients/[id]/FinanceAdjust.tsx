"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { setRecorrencia, addPriceChange, includePackage, editPriceHistory, deletePriceHistory } from "../actions";
import { formatBRL, formatDate } from "@/lib/therapy";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

type PriceEntry = { id: string; valor: string; dataEfetiva: string };
type ContractEntry = { id: string; type: string; from: string | null; to: string | null; description: string | null; date: string };

export function FinanceAdjust({
  patientId, frequency, priceHistory, contractHistory,
}: {
  patientId: string;
  frequency: string | null;
  priceHistory: PriceEntry[];
  contractHistory: ContractEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const recRef = useRef<HTMLFormElement>(null);
  const valRef = useRef<HTMLFormElement>(null);
  const pkgRef = useRef<HTMLFormElement>(null);

  function run(action: (fd: FormData) => Promise<unknown>, form: HTMLFormElement | null, ok: string) {
    if (!form) return;
    const fd = new FormData(form);
    start(async () => {
      await action(fd);
      form.reset();
      setToast(ok);
      setTimeout(() => setToast(null), 2500);
      router.refresh();
    });
  }

  const recHist = contractHistory.filter((h) => h.type === "recorrencia" || h.type === "model");

  return (
    <div className="glass-card rounded-[24px] p-5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <span className="text-sm font-bold text-primary flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Ajustes</span>
        <span className="text-xs text-foreground/40">{open ? "fechar" : "ajustar"}</span>
      </button>

      {toast && <div className="mt-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] px-3 py-2 text-sm font-semibold text-[#047857]">✅ {toast}</div>}

      {open && (
        <div className="mt-4 space-y-4">
          {/* 1. Recorrência */}
          <form ref={recRef} onSubmit={(e) => { e.preventDefault(); run(setRecorrencia.bind(null, patientId), recRef.current, "Recorrência atualizada."); }} className="rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Recorrência</p>
            <p className="text-[11px] text-foreground/50">Não tem vínculo com quantidade nem com valores. Atual: <strong className="capitalize">{frequency || "—"}</strong></p>
            <div className="flex items-end gap-2">
              <select name="recorrencia" defaultValue="" className={inputCls} required>
                <option value="" disabled>Selecione…</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
              </select>
              <button disabled={pending} className="bg-primary text-white py-2.5 px-4 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">Salvar</button>
            </div>
          </form>

          {/* 2. Ajuste do valor da sessão */}
          <form ref={valRef} onSubmit={(e) => { e.preventDefault(); run(addPriceChange.bind(null, patientId), valRef.current, "Valor ajustado."); }} className="rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Ajuste do valor da sessão</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-foreground/50">Novo valor (R$)</label>
                <input name="valor" inputMode="decimal" required placeholder="ex: 220,00" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground/50">Passa a valer em</label>
                <input name="dataEfetiva" type="date" className={inputCls} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground/50">Válido até (reajuste)</label>
                <input name="priceReviewDate" type="date" className={inputCls} />
              </div>
            </div>
            <button disabled={pending} className="bg-primary text-white py-2.5 px-4 rounded-xl font-bold text-sm disabled:opacity-60">Salvar</button>
          </form>

          {/* 3. Incluir pacote */}
          <form ref={pkgRef} onSubmit={(e) => { e.preventDefault(); run(includePackage.bind(null, patientId), pkgRef.current, "Pacote incluído."); }} className="rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Incluir pacote</p>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-[11px] font-semibold text-foreground/50">Quantidade de sessões</label>
                <input name="sessionsInPacket" type="number" min={1} max={200} required placeholder="ex: 8" className={inputCls} />
              </div>
              <button disabled={pending} className="bg-primary text-white py-2.5 px-4 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">Incluir</button>
            </div>
          </form>
        </div>
      )}

      {/* Histórico (editável) */}
      <div className="mt-4 pt-4 border-t border-border space-y-3">
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
      </div>
    </div>
  );
}
