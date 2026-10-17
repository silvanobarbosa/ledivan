"use client";

import { useState, useTransition } from "react";
import { saveTaxas } from "./taxas-actions";

/**
 * Taxas da maquininha (doc 47). Guarda o percentual descontado no débito e no crédito; o Financeiro
 * usa para mostrar o valor LÍQUIDO ao lado do bruto. Não altera o valor lançado.
 */
export function TaxasCard({ initial }: { initial: { debito?: number; credito?: number } | null }) {
  const [debito, setDebito] = useState(initial?.debito ? String(initial.debito).replace(".", ",") : "");
  const [credito, setCredito] = useState(initial?.credito ? String(initial.credito).replace(".", ",") : "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => start(async () => {
    const r = await saveTaxas({ debito, credito });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  });

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Taxas da maquininha</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>
      <p className="text-sm text-foreground/50">
        Percentual que a operadora desconta em cada recebimento no cartão. Usado para mostrar o valor
        <b> líquido</b> (o que cai na conta) ao lado do valor lançado no Financeiro. O valor lançado não muda.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Débito (%)</label>
          <input value={debito} onChange={(e) => setDebito(e.target.value)} inputMode="decimal" placeholder="ex: 1,5" className={field} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Crédito (%)</label>
          <input value={credito} onChange={(e) => setCredito(e.target.value)} inputMode="decimal" placeholder="ex: 4,0" className={field} />
        </div>
      </div>

      <button onClick={save} disabled={pending} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Salvando…" : "Salvar taxas"}
      </button>
    </section>
  );
}
