"use client";

import { useState, useTransition } from "react";
import { saveConsentForm } from "./consent-actions";

export function ConsentCard({ initial }: { initial: { title: string; body: string } | null }) {
  const [title, setTitle] = useState(initial?.title ?? "Termo de Consentimento");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => start(async () => {
    const r = await saveConsentForm(title, body);
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  });

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Termo de consentimento</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>
      <p className="text-sm text-foreground/50">Ative o recurso <b>Consentimento</b> acima. O paciente vê este termo no app e assina digitalmente (nome + carimbo de data/hora). Ao editar o texto, quem já assinou precisa reassinar a nova versão.</p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título do termo"
        maxLength={200}
        className="w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Cole ou escreva o texto do termo de consentimento…"
        maxLength={20000}
        rows={8}
        className="w-full rounded-2xl border border-border/60 bg-white/60 px-4 py-3 text-sm outline-none focus:border-primary resize-y"
      />
      <button
        onClick={save}
        disabled={pending || !title.trim() || !body.trim()}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar termo"}
      </button>
    </section>
  );
}
