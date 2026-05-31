"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { setAutoLinkPayments } from "./actions";

export function AutoLinkToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(() => setAutoLinkPayments(next));
  };

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border flex items-start gap-5">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Link2 className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-primary">Vincular pagamentos ao financeiro</h4>
        <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
          Quando ativo, cada pagamento de sessão registrado vira automaticamente uma transação de receita no módulo financeiro.
          Você ainda pode decidir caso a caso ao registrar cada pagamento.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={enabled}
        className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-foreground/20"}`}
      >
        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
