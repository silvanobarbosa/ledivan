"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir / Salvar PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-[#2b1830] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition print:hidden"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
