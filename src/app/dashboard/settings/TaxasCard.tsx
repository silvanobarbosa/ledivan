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
  const [validFrom, setValidFrom] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const salvar = () => start(async () => {
    setMsg(null);
    const r = await adicionarVigenciaTaxa({ debito, credito, validFrom });
    if (r.ok) { setDebito(""); setCredito(""); setValidFrom(""); setMsg("salvo ✓"); setTimeout(() => setMsg(null), 1500); }
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
          <span className="font-semibold text-foreground/70">Em vigor:</span> débito {atual.debito}% · crédito {atual.credito}% <span className="text-foreground/40">(desde {dataBR(atual.validFrom)})</span>
        </div>
      )}

      {/* Nova vigência */}
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="text-sm font-bold text-foreground">Nova vigência</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Débito (%)</label>
            <input value={debito} onChange={(e) => setDebito(e.target.value)} inputMode="decimal" placeholder="ex: 2" className={field} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Crédito (%)</label>
            <input value={credito} onChange={(e) => setCredito(e.target.value)} inputMode="decimal" placeholder="ex: 3" className={field} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest">A partir de</label>
            <input value={validFrom} onChange={(e) => setValidFrom(e.target.value)} type="date" className={field} />
          </div>
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
              <span className="flex-1">débito {v.debito}% · crédito {v.credito}%</span>
              <button onClick={() => remover(v.id)} disabled={pending} title="Remover esta vigência" className="text-foreground/30 hover:text-red-600 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
