"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { adicionarVigenciaTaxa, removerVigenciaTaxa, type VigenciaTaxaDTO } from "./taxas-actions";

const dataBR = (iso: string) => { const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };

/**
 * Taxas da maquininha COM VIGÊNCIA (doc 49). Cada alteração vira uma nova vigência com data de início;
 * o cálculo do líquido usa a taxa vigente na data de CADA pagamento (o passado nunca é recalculado).
 */
export function TaxasCard({ vigencias }: { vigencias: VigenciaTaxaDTO[] }) {
  const atual = vigencias[0] ?? null;
  const [debito, setDebito] = useState("");
  const [credito, setCredito] = useState("");
  const [credito2x, setCredito2x] = useState("");
  const [credito3x, setCredito3x] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const salvar = () => start(async () => {
    setMsg(null);
    const r = await adicionarVigenciaTaxa({ debito, credito, credito2x, credito3x, validFrom });
    if (r.ok) { setDebito(""); setCredito(""); setCredito2x(""); setCredito3x(""); setValidFrom(""); setMsg("salvo ✓"); setTimeout(() => setMsg(null), 1500); }
    else setMsg(r.error || "não deu para salvar");
  });

  const remover = (id: string) => start(async () => { await removerVigenciaTaxa(id); });

  const field = "w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary";

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Taxas da maquininha</h3>
        {msg && <span className="text-xs text-green-600 font-semibold">{msg}</span>}
      </div>
      <p className="text-sm text-foreground/50">
        Percentual que a operadora desconta em cada recebimento no cartão. O valor lançado não muda — o
        líquido (o que cai na conta) aparece nos <b>totais recebidos</b>. Cada alteração cria uma
        <b> vigência</b> com data de início e <b>não recalcula</b> os pagamentos anteriores.
      </p>

      {atual && (
        <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3 text-sm">
          <span className="font-semibold text-foreground/70">Em vigor:</span> débito {atual.debito}% · crédito à vista {atual.credito}% · 2x {atual.credito2x}% · 3x {atual.credito3x}% <span className="text-foreground/40">(desde {dataBR(atual.validFrom)})</span>
        </div>
      )}

      {/* Nova vigência */}
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="text-sm font-bold text-foreground">Nova vigência</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Débito (%)</label>
            <input value={debito} onChange={(e) => setDebito(e.target.value)} inputMode="decimal" placeholder="ex: 2" className={field} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Créd. à vista (%)</label>
            <input value={credito} onChange={(e) => setCredito(e.target.value)} inputMode="decimal" placeholder="ex: 3" className={field} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Créd. 2x (%)</label>
            <input value={credito2x} onChange={(e) => setCredito2x(e.target.value)} inputMode="decimal" placeholder="ex: 5" className={field} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Créd. 3x (%)</label>
            <input value={credito3x} onChange={(e) => setCredito3x(e.target.value)} inputMode="decimal" placeholder="ex: 7" className={field} />
          </div>
        </div>
        <div className="space-y-1 max-w-[220px]">
          <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">A partir de</label>
          <input value={validFrom} onChange={(e) => setValidFrom(e.target.value)} type="date" className={field} />
        </div>
        <button onClick={salvar} disabled={pending || !validFrom} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Salvando…" : "Registrar vigência"}
        </button>
      </div>

      {/* Histórico */}
      {vigencias.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-4">
          <h4 className="text-sm font-bold text-foreground">Histórico</h4>
          {vigencias.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl bg-surface/40 px-3 py-2 text-sm">
              <span className="text-foreground/40 w-24 shrink-0">desde {dataBR(v.validFrom)}</span>
              <span className="flex-1">déb {v.debito}% · cré {v.credito}% · 2x {v.credito2x}% · 3x {v.credito3x}%</span>
              <button onClick={() => remover(v.id)} disabled={pending} title="Remover esta vigência" className="text-foreground/30 hover:text-red-600 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
