"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptConsent } from "./actions";

export function ConsentForm() {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  return (
    <form action={acceptConsent} className="space-y-4">
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 cursor-pointer">
        <input type="checkbox" name="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="accent-primary w-5 h-5 mt-0.5 shrink-0" />
        <span className="text-sm">Li e aceito os <Link href="/termos" target="_blank" className="text-primary font-semibold underline">Termos de Uso</Link>.</span>
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-white/70 px-4 py-3 cursor-pointer">
        <input type="checkbox" name="privacy" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="accent-primary w-5 h-5 mt-0.5 shrink-0" />
        <span className="text-sm">Li e aceito a <Link href="/privacidade" target="_blank" className="text-primary font-semibold underline">Política de Privacidade</Link> (LGPD).</span>
      </label>
      <button disabled={!terms || !privacy} className="w-full bg-primary text-white py-3 rounded-2xl font-bold disabled:opacity-40 disabled:cursor-not-allowed transition">
        Aceitar e continuar
      </button>
      <p className="text-[11px] text-foreground/40 text-center">É necessário aceitar ambos para usar o Ledivan.</p>
    </form>
  );
}
