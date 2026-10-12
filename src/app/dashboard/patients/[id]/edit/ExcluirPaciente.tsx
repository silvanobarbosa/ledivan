"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/**
 * Excluir paciente com CONFIRMAÇÃO (doc 35): a exclusão é irreversível, então pede confirmação na
 * própria linha — nada de `confirm()` do navegador (a conta demo é read-only e o nosso padrão não usa).
 */
export function ExcluirPaciente({ remove }: { remove: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, start] = useTransition();

  if (!confirmando) {
    return (
      <div className="flex justify-end">
        <button type="button" onClick={() => setConfirmando(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-500/70 hover:text-red-600 transition px-4 py-2 cursor-pointer">
          <Trash2 className="w-4 h-4" /> Excluir paciente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <span className="text-sm text-[#991b1b]">Tem certeza que deseja excluir? Não será possível reverter essa exclusão.</span>
      <button type="button" onClick={() => start(() => remove())} disabled={pending} className="text-sm font-bold text-red-600 disabled:opacity-50 cursor-pointer">
        {pending ? "Excluindo…" : "Sim, excluir"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} disabled={pending} className="text-sm font-semibold text-foreground/60 cursor-pointer">
        Não
      </button>
    </div>
  );
}
