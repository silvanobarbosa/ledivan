"use client";

import { useActionState } from "react";
import { KeyRound, Check } from "lucide-react";
import { changePassword } from "./actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePassword, { ok: false } as { ok: boolean; error?: string });
  return (
    <div className="glass-card rounded-[24px] p-6">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest flex items-center gap-2 mb-3"><KeyRound className="w-4 h-4" /> Senha de acesso</p>
      <form action={action} className="space-y-3 max-w-sm" key={state.ok ? "done" : "form"}>
        {hasPassword && (
          <div>
            <label className="text-xs font-semibold text-foreground/60">Senha atual</label>
            <input name="current" type="password" autoComplete="current-password" className={inputCls} />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-foreground/60">Nova senha</label>
          <input name="next" type="password" autoComplete="new-password" required minLength={8} className={inputCls} placeholder="mín. 8 caracteres" />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground/60">Confirmar nova senha</label>
          <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={inputCls} />
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-[#047857] font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Senha atualizada.</p>}
        <button disabled={pending} className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold text-sm disabled:opacity-60">{pending ? "Salvando…" : "Salvar senha"}</button>
      </form>
      {!hasPassword && <p className="text-[11px] text-foreground/40 mt-2">Você entra via Google. Definir uma senha permite login por e-mail também.</p>}
    </div>
  );
}
