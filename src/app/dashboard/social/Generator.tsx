"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateSocialPost } from "./actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export function Generator() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await generateSocialPost(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao gerar.");
      }
    });
  }

  return (
    <form action={onSubmit} className="glass-card rounded-[28px] p-6 space-y-4">
      <p className="font-semibold text-primary flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Novo post</p>
      <div>
        <label className="text-xs font-semibold text-foreground/60">Tema</label>
        <input name="theme" className={inputCls} placeholder="ex: lidando com a ansiedade, autocuidado, divulgar consultório" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground/60">Rede</label>
          <select name="network" className={inputCls} defaultValue="instagram">
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="whatsapp">Status/WhatsApp</option>
            <option value="geral">Geral</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground/60">Tom</label>
          <select name="tone" className={inputCls} defaultValue="acolhedor">
            <option value="acolhedor">Acolhedor</option>
            <option value="educativo">Educativo</option>
            <option value="inspirador">Inspirador</option>
            <option value="profissional">Profissional</option>
            <option value="leve">Leve</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-2 bg-primary text-white py-2.5 px-5 rounded-xl font-bold transition hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100">
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</> : <><Sparkles className="w-4 h-4" /> Gerar com IA</>}
      </button>
    </form>
  );
}
