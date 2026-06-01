"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { logMood } from "../actions";

const MOODS = [
  { v: 1, emoji: "😣", label: "Muito mal" },
  { v: 2, emoji: "😕", label: "Mal" },
  { v: 3, emoji: "😐", label: "Neutro" },
  { v: 4, emoji: "🙂", label: "Bem" },
  { v: 5, emoji: "😄", label: "Muito bem" },
];

export function MoodForm({ token }: { token: string }) {
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!mood) { setError("Escolha como está se sentindo."); return; }
    setError(null);
    const fd = new FormData();
    fd.append("mood", String(mood));
    fd.append("note", note);
    startTransition(async () => {
      const res = await logMood(token, fd);
      if (res.ok) setDone(true);
      else setError(res.error || "Falha ao registrar.");
    });
  }

  if (done) {
    return (
      <div className="mt-6 text-center">
        <p className="text-4xl">🌿</p>
        <p className="font-display mt-2 text-xl font-medium text-[color:var(--brand-eggplant)]">Registrado!</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Obrigado por compartilhar.</p>
        <button onClick={() => { setDone(false); setMood(null); setNote(""); }} className="mt-4 text-sm font-semibold text-[color:var(--accent-violet)] hover:underline">
          Registrar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex justify-between gap-2">
        {MOODS.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => setMood(m.v)}
            className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-3 transition ${mood === m.v ? "bg-[color:var(--accent-violet)]/15 ring-2 ring-[color:var(--accent-violet)]/40" : "hover:bg-white/60"}`}
            title={m.label}
          >
            <span className="text-3xl">{m.emoji}</span>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">{m.label}</span>
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Quer escrever algo? (opcional)"
        className="w-full rounded-2xl border border-[rgba(43,24,48,0.12)] bg-white/70 px-4 py-3 text-sm text-ink placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--accent-violet)] focus:ring-4 focus:ring-[rgba(139,92,246,0.15)] transition"
      />
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button
        onClick={submit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition disabled:opacity-60"
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</> : "Registrar humor"}
      </button>
    </div>
  );
}
