"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Ícone "ⓘ" com dica. Abre ao passar o mouse (desktop) E ao TOCAR/clicar (celular) — o doc 21 pede
 * que todos esses recursos funcionem no celular, e no toque não existe hover. Clicar fora ou apertar
 * Esc fecha. É um `button type="button"` para nunca enviar o formulário em que estiver.
 */
export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const foraFecha = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const escFecha = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", foraFecha);
    document.addEventListener("keydown", escFecha);
    return () => { document.removeEventListener("mousedown", foraFecha); document.removeEventListener("keydown", escFecha); };
  }, [aberto]);

  return (
    <span ref={ref} className={`relative inline-flex items-center group/info align-middle ml-1 ${className}`}>
      <button
        type="button"
        aria-label={text}
        aria-expanded={aberto}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((v) => !v); }}
        className="inline-flex items-center"
      >
        <Info className="w-3.5 h-3.5 text-foreground/40 hover:text-primary cursor-pointer" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 max-w-[calc(100vw-2rem)] break-words text-left rounded-xl bg-primary text-white text-xs leading-snug px-3 py-2 transition z-50 shadow-lg shadow-primary/30 group-hover/info:opacity-100 group-hover/info:visible ${aberto ? "opacity-100 visible" : "opacity-0 invisible"}`}
      >
        {text}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-primary rotate-45 -mt-1" />
      </span>
    </span>
  );
}
