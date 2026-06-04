"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";
import { submitAssignmentResponse } from "../actions";

const inputCls =
  "w-full rounded-2xl border border-[rgba(43,24,48,0.12)] bg-white/70 px-4 py-3 text-sm text-ink placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--accent-violet)] focus:ring-4 focus:ring-[rgba(139,92,246,0.15)] transition";

const ACCEPT: Record<string, string> = {
  foto: "image/*",
  audio: "audio/*",
  video: "video/*",
  texto: "",
  livre: "image/*,audio/*,video/*",
};

const HINT: Record<string, string> = {
  foto: "Anexe uma foto (ex: um desenho, registro).",
  audio: "Grave/anexe um áudio.",
  video: "Anexe um vídeo.",
  texto: "Escreva sua resposta abaixo.",
  livre: "Escreva e/ou anexe foto, áudio ou vídeo.",
};

export function ResponseForm({ token, responseType }: { token: string; responseType: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await submitAssignmentResponse(token, formData);
      if (res.ok) setDone(true);
      else setError(res.error || "Falha ao enviar.");
    });
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <p className="font-display text-lg font-medium text-[color:var(--brand-eggplant)]">Enviado! 🌿</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Obrigado por responder.</p>
      </div>
    );
  }

  const accept = ACCEPT[responseType] ?? "";

  return (
    <form action={onSubmit} className="space-y-3">
      <p className="text-xs text-[color:var(--muted-foreground)]">{HINT[responseType] ?? HINT.livre}</p>
      <textarea name="responseText" rows={5} placeholder="Escreva aqui sua resposta..." className={inputCls} />
      {responseType !== "texto" && (
        <label className="flex items-center gap-2 text-sm text-[color:var(--brand-eggplant)] cursor-pointer rounded-2xl border border-dashed border-[rgba(43,24,48,0.2)] px-4 py-3 hover:bg-white/60 transition">
          <Paperclip className="h-4 w-4" />
          <span>Anexar arquivo</span>
          <input type="file" name="file" accept={accept || undefined} className="hidden" />
        </label>
      )}
      {error && <p className="text-sm text-[#b91c1c]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar resposta</>}
      </button>
    </form>
  );
}
