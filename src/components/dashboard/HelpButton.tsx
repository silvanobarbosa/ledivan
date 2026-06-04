"use client";

import { HelpCircle, Sparkles } from "lucide-react";
import Link from "next/link";

// "Tutorial" reabre o tour guiado; "?" leva à Central de Ajuda / FAQ.
export function HelpButton() {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.dispatchEvent(new Event("ledivan-open-tour"))}
        title="Refazer o tutorial guiado"
        className="inline-flex items-center gap-1.5 px-3 py-2 lg:py-2.5 bg-white border border-border rounded-2xl text-sm font-semibold text-foreground/70 hover:text-primary hover:border-primary transition"
      >
        <Sparkles className="w-4 h-4 text-accent" />
        <span className="hidden sm:inline">Tutorial</span>
      </button>
      <Link
        href="/dashboard/ajuda"
        title="Central de ajuda e perguntas frequentes"
        aria-label="Ajuda"
        className="p-2 lg:p-3 bg-white border border-border rounded-2xl text-foreground/60 hover:text-primary hover:border-primary transition"
      >
        <HelpCircle className="w-5 h-5" />
      </Link>
    </div>
  );
}
