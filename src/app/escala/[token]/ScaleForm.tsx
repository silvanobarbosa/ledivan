"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { submitScale } from "../actions";
import { SCALES, type ScaleType } from "@/lib/scales";

export function ScaleForm({ token, scaleType }: { token: string; scaleType: ScaleType }) {
  const scale = SCALES[scaleType];
  const [answers, setAnswers] = useState<(number | null)[]>(Array(scale.items.length).fill(null));
  const [done, setDone] = useState<{ score: number; severity: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(i: number, v: number) {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? v : a)));
  }

  function submit() {
    if (answers.some((a) => a == null)) { setError("Responda todas as perguntas."); return; }
    setError(null);
    startTransition(async () => {
      const res = await submitScale(token, answers as number[]);
      if (res.ok) setDone({ score: res.score!, severity: res.severity! });
      else setError(res.error || "Falha ao enviar.");
    });
  }

  if (done) {
    return (
      <div className="mt-6 text-center">
        <p className="text-4xl">🌿</p>
        <p className="font-display mt-2 text-xl font-medium text-[color:var(--brand-eggplant)]">Respondido!</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Obrigado por responder. Seu terapeuta vai avaliar.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-[color:var(--ink)]/80">{scale.intro}</p>
      {scale.items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-[rgba(43,24,48,0.08)] bg-white/50 p-4">
          <p className="text-sm font-medium text-[color:var(--brand-eggplant)] mb-3">{i + 1}. {item}</p>
          <div className="grid grid-cols-2 gap-2">
            {scale.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set(i, o.value)}
                className={`text-xs font-semibold rounded-xl px-3 py-2 text-left transition ${
                  answers[i] === o.value
                    ? "bg-[color:var(--accent-violet)] text-cream"
                    : "bg-white/70 text-[color:var(--ink)]/70 hover:bg-white"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition disabled:opacity-60"
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar respostas</>}
      </button>
    </div>
  );
}
