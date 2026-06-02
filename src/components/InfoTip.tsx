import { Info } from "lucide-react";

// Ícone "i" com dica ao passar o mouse (CSS puro). Acessível via title também.
export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`relative inline-flex items-center group/info align-middle ml-1 ${className}`}>
      <Info className="w-3.5 h-3.5 text-foreground/40 hover:text-primary cursor-help" aria-label={text} />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 rounded-xl bg-primary text-white text-xs leading-snug px-3 py-2 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition z-50 shadow-lg shadow-primary/30"
      >
        {text}
        <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-primary rotate-45 -mt-1" />
      </span>
    </span>
  );
}
