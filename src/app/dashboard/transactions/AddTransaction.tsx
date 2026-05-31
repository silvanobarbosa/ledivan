"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createTransaction } from "./actions";

type Cat = { id: string; name: string; type: string };
type Acc = { id: string; name: string };

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export function AddTransaction({ categories, accounts }: { categories: Cat[]; accounts: Acc[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");

  const cats = categories.filter((c) => c.type === type);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
      >
        {open ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        <span>{open ? "Fechar" : "Novo lançamento"}</span>
      </button>

      {open && (
        <form action={createTransaction} className="glass-card rounded-[28px] p-6 mt-4 grid sm:grid-cols-2 gap-4">
          {/* Tipo */}
          <div className="sm:col-span-2 flex gap-2">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition ${
                  type === t
                    ? t === "income"
                      ? "bg-[#ecfdf5] text-[#047857] ring-2 ring-[#047857]/30"
                      : "bg-[#fee2e2] text-[#b91c1c] ring-2 ring-[#b91c1c]/30"
                    : "bg-white/60 text-foreground/50"
                }`}
              >
                {t === "income" ? "Receita" : "Despesa"}
              </button>
            ))}
            <input type="hidden" name="type" value={type} />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground/60">Valor (R$)</label>
            <input name="amount" inputMode="decimal" required placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Data</label>
            <input name="date" type="date" className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-foreground/60">Descrição</label>
            <input name="description" placeholder="ex: Aluguel da sala" className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground/60">Categoria</label>
            <select name="categoryId" className={inputCls} defaultValue="">
              <option value="">— Sem categoria —</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/60">Conta</label>
            <select name="accountId" className={inputCls} defaultValue={accounts[0]?.id ?? ""}>
              <option value="">— Nenhuma —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <button className="sm:col-span-2 bg-primary text-white py-3 rounded-xl font-bold mt-1">
            Salvar lançamento
          </button>
        </form>
      )}
    </div>
  );
}
