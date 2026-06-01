"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Copy, Check, MessageCircle } from "lucide-react";
import { generateSessionSummary } from "../../sessions/actions";

export function SessionSummary({
  sessionId, initialSummary, hasNotes, patientName, patientPhone,
}: {
  sessionId: string; initialSummary: string | null; hasNotes: boolean; patientName: string; patientPhone: string | null;
}) {
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [open, setOpen] = useState(!!initialSummary);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateSessionSummary(sessionId);
      if (res.ok) { setSummary(res.summary!); setOpen(true); }
      else setError(res.error || "Falha.");
    });
  }

  const waDigits = (patientPhone || "").replace(/\D/g, "");
  const waNumber = waDigits ? (waDigits.length <= 11 ? `55${waDigits}` : waDigits) : "";
  const waText = summary ? `Olá, ${patientName}! Resumo da nossa sessão:\n\n${summary}` : "";

  if (!hasNotes && !summary) {
    return <p className="text-[11px] text-foreground/30">Adicione notas à sessão para gerar um resumo p/ o paciente.</p>;
  }

  return (
    <div className="w-full">
      {!summary ? (
        <button onClick={generate} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
          {pending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><Sparkles className="w-3.5 h-3.5" /> Resumo p/ paciente (IA)</>}
        </button>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <Sparkles className="w-3.5 h-3.5" /> Resumo p/ paciente {open ? "▲" : "▼"}
          </button>
          {open && (
            <div className="rounded-xl bg-[#f3e8ff]/40 border border-primary/10 p-3 space-y-2">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{summary}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white hover:bg-surface transition">
                  {copied ? <><Check className="w-3 h-3 text-[#047857]" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                </button>
                <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white hover:bg-surface transition">
                  <MessageCircle className="w-3 h-3 text-[#25D366]" /> Enviar no WhatsApp
                </a>
                <button onClick={generate} disabled={pending} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white hover:bg-surface transition disabled:opacity-50">
                  {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Regerar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
