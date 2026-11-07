"use client";

import { useActionState, useState } from "react";
import { KeyRound, Check, Eye, EyeOff } from "lucide-react";
import { changePassword } from "./actions";

const inputCls = "w-full px-4 py-2.5 pr-11 rounded-xl bg-white border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

/**
 * Campo de senha com o olho de VER o que se digitou (doc 19).
 *
 * Três campos ocultos seguidos é onde o erro de digitação se esconde: a pessoa erra num, acerta
 * no outro, e a tela só sabe dizer "a confirmação não confere". Ver o que se escreveu é o que
 * encurta isso. O padrão continua oculto — mostrar é uma escolha de quem está na frente da tela.
 */
function CampoSenha({ name, label, autoComplete, required, minLength }: {
  name: string;
  label: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div>
      <label htmlFor={`senha-${name}`} className="text-xs font-semibold text-foreground/60">{label}</label>
      <div className="relative">
        <input
          id={`senha-${name}`}
          name={name}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={minLength ? `mín. ${minLength} caracteres` : undefined}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 cursor-pointer"
        >
          {visivel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function PasswordCard({ hasPassword, pedeAtual }: { hasPassword: boolean; pedeAtual: boolean }) {
  const [state, action, pending] = useActionState(changePassword, { ok: false } as { ok: boolean; error?: string });
  return (
    <div className="glass-card rounded-[24px] p-6">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest flex items-center gap-2 mb-3"><KeyRound className="w-4 h-4" /> Senha de acesso</p>
      <form action={action} className="space-y-3 max-w-sm" key={state.ok ? "done" : "form"}>
        {pedeAtual && <CampoSenha name="current" label="Senha atual" autoComplete="current-password" />}
        <CampoSenha name="next" label="Nova senha" autoComplete="new-password" required minLength={8} />
        <CampoSenha name="confirm" label="Confirmar nova senha" autoComplete="new-password" required minLength={8} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-[#047857] font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Senha atualizada.</p>}
        <button disabled={pending} className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold text-sm disabled:opacity-60">{pending ? "Salvando…" : "Salvar senha"}</button>
      </form>
      {!hasPassword && <p className="text-[11px] text-foreground/40 mt-2">Você entra via Google ou por código no e-mail. Definir uma senha permite entrar por e-mail e senha também.</p>}
      {hasPassword && !pedeAtual && (
        <p className="text-[11px] text-foreground/40 mt-2">
          Você entrou sem usar a senha, então não precisa informar a atual para trocá-la.
        </p>
      )}
    </div>
  );
}
