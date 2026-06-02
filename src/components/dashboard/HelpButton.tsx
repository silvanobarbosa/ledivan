"use client";

import { HelpCircle } from "lucide-react";

// Reabre o tour guiado de qualquer lugar.
export function HelpButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("ledivan-open-tour"))}
      title="Tour guiado / ajuda"
      className="p-2 lg:p-3 bg-white border border-border rounded-2xl text-foreground/60 hover:text-primary hover:border-primary transition"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
