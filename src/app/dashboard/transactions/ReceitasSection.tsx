"use client";

import { useState, useTransition } from "react";
import { Plus, X, Pencil, Trash2, Check } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { criarReceita, editarReceita, excluirReceita, marcarReceitaRecebida } from "./receitas-actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export type ReceitaLinha = { id: string; nome: string; valor: string; recebimento: string; recebido: boolean };

const dataBR = (iso: string | null | undefined) => { const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null; return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };
const dataInput = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");
const inputCls = "w-full px-3 py-2 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

/** Quadro de Receitas pessoais (doc 50): cadastro (com repetir mensal), edição por lápis, exclusão
 *  por lixeira. O chip "Recebido/Previsto" marca a entrada (dirige a cor no extrato). */
export function ReceitasSection({ receitas }: { receitas: ReceitaLinha[] }) {
  const [novo, setNovo] = useState(false);
  const [repetir, setRepetir] = useState(false);
  const [editando, setEditando] = useState<ReceitaLinha | null>(null);
  const [pending, start] = useTransition();

  const alternarRecebido = (r: ReceitaLinha) => start(() => marcarReceitaRecebida(r.id, !r.recebido));

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-lg font-bold text-primary">Receitas pessoais</h3>
        <button onClick={() => setNovo((o) => !o)} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm">
          {novo ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {novo ? "Fechar" : "Cadastrar Receita Pessoal"}
        </button>
      </div>

      {novo && (
        <form action={criarReceita} onSubmit={() => { setNovo(false); setRepetir(false); }} className="grid sm:grid-cols-2 gap-3 rounded-2xl bg-white/60 border border-border p-4">
          {/* Ordem do doc: data do recebimento, nome, valor, repetir. */}
          <div><label className="text-xs font-semibold text-foreground/60">Data do recebimento</label><input name="recebimento" type="date" required className={inputCls} /></div>
          <div><label className="text-xs font-semibold text-foreground/60">Valor (R$)</label><input name="valor" inputMode="decimal" required placeholder="0,00" className={inputCls} /></div>
          <div className="sm:col-span-2"><label className="text-xs font-semibold text-foreground/60">Nome da receita</label><input name="nome" required placeholder="ex: Aula particular" className={inputCls} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-foreground/70 cursor-pointer"><input type="checkbox" name="recebido" className="w-4 h-4 accent-primary" /> Já recebido</label>
          <div className="sm:col-span-2 rounded-xl bg-white/70 border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground/70 cursor-pointer">
              <input type="checkbox" name="repetir" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} className="w-4 h-4 accent-primary" /> Repetir todo mês
            </label>
            {repetir && <div className="flex items-center gap-2 pl-6"><span className="text-xs text-foreground/60">Por</span><input name="meses" type="number" min={2} max={60} defaultValue={12} className="w-20 px-3 py-1.5 rounded-lg bg-white border border-border text-sm outline-none" /><span className="text-xs text-foreground/60">meses.</span></div>}
          </div>
          <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Salvar receita</button>
        </form>
      )}

      {receitas.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhuma receita pessoal cadastrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-center text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
                <th className="py-2">Recebimento</th><th className="py-2">Nome</th><th className="py-2">Valor</th><th className="py-2">Situação</th><th className="py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {receitas.map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2 text-center tabular-nums">{dataBR(r.recebimento)} <button onClick={() => setEditando(r)} title="Editar" className="text-foreground/30 hover:text-primary align-middle"><Pencil className="inline w-3.5 h-3.5" /></button></td>
                  <td className="py-2 font-medium">{r.nome}</td>
                  <td className={`py-2 text-center tabular-nums font-semibold ${r.recebido ? "text-[#047857]" : "text-foreground"}`}>{formatBRL(r.valor)} <button onClick={() => setEditando(r)} title="Editar" className="text-foreground/30 hover:text-primary align-middle"><Pencil className="inline w-3.5 h-3.5" /></button></td>
                  <td className="py-2 text-center">
                    <button onClick={() => alternarRecebido(r)} disabled={pending} className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition ${r.recebido ? "bg-[#dcfce7] text-[#166534]" : "bg-surface text-foreground/50 hover:bg-surface-container"}`}>
                      {r.recebido ? <><Check className="w-3 h-3" /> Recebido</> : "Previsto"}
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <form action={(fd) => excluirReceita(fd.get("id") as string)} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmit message={`Excluir a receita "${r.nome}"?`} title="Excluir" className="text-foreground/30 hover:text-red-600"><Trash2 className="w-4 h-4" /></ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={() => setEditando(null)}>
          <form action={editarReceita} onSubmit={() => setEditando(null)} className="bg-white rounded-[24px] p-6 w-full max-w-sm space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-display text-lg font-bold text-primary">Editar receita</p><button type="button" onClick={() => setEditando(null)} aria-label="Fechar"><X className="w-5 h-5 text-foreground/40" /></button></div>
            <p className="text-sm text-foreground/60">{editando.nome}</p>
            <input type="hidden" name="id" value={editando.id} />
            <div><label className="text-xs font-semibold text-foreground/60">Data do recebimento</label><input name="recebimento" type="date" defaultValue={dataInput(editando.recebimento)} className={inputCls} /></div>
            <div><label className="text-xs font-semibold text-foreground/60">Valor (R$)</label><input name="valor" inputMode="decimal" defaultValue={Number(editando.valor).toFixed(2).replace(".", ",")} className={inputCls} /></div>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground/70 cursor-pointer"><input type="checkbox" name="recebido" defaultChecked={editando.recebido} className="w-4 h-4 accent-primary" /> Recebido</label>
            <button className="w-full bg-primary text-white py-2.5 rounded-xl font-bold">Salvar</button>
          </form>
        </div>
      )}
    </section>
  );
}
