"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Copy, Check } from "lucide-react";
import { setBookingSlug } from "./actions";

export function BookingCard({ initialSlug }: { initialSlug: string | null }) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [saved, setSaved] = useState(initialSlug ?? "");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://levianpuls.vercel.app";
  const link = saved ? `${origin}/agendar/${saved}` : "";

  function save() {
    startTransition(async () => {
      const res = await setBookingSlug(slug);
      if (res.ok && res.slug) {
        setSlug(res.slug);
        setSaved(res.slug);
      }
    });
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-5">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <CalendarCheck className="w-5 h-5 text-primary" /> Link de autoagendamento
      </h3>
      <p className="text-sm text-foreground/50 leading-relaxed">
        Compartilhe um link público para o paciente solicitar horário. Cada pedido entra na sua agenda e cria um prospect.
      </p>

      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground/40 shrink-0">/agendar/</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="seu-nome"
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm"
        />
        <button onClick={save} disabled={pending} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
          {pending ? "..." : "Salvar"}
        </button>
      </div>

      {link && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface/60 border border-border px-4 py-3">
          <span className="flex-1 text-sm text-primary truncate">{link}</span>
          <button onClick={copy} className="text-foreground/50 hover:text-primary transition" title="Copiar">
            {copied ? <Check className="w-4 h-4 text-[#047857]" /> : <Copy className="w-4 h-4" />}
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">Abrir</a>
        </div>
      )}
    </div>
  );
}
