"use client";

import { useState, useTransition } from "react";
import { Mic } from "lucide-react";
import { setTranscriptionEnabled } from "./actions";

export function TranscriptionToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    startTransition(() => setTranscriptionEnabled(next));
  };

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border flex items-start gap-5">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Mic className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-primary">Transcrição de sessão por IA</h4>
        <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
          Quando ativo, você pode enviar o áudio da sessão para gerar um rascunho de evolução no prontuário.
          O uso é opcional e exige o <strong>consentimento do paciente</strong>, confirmado em tela a cada uso.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={enabled}
        className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-foreground/20"}`}
      >
        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
