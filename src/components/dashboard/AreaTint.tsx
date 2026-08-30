"use client";

import { usePathname } from "next/navigation";

// Tinge o fundo da área financeira diferente da clínica — passa a sensação de
// "dois produtos em um". Clínica = creme (warm); Financeiro = verde-água (cool).
const FINANCE_PREFIXES = [
  "/dashboard/financeiro",
  "/dashboard/visao-financeira",
  "/dashboard/transactions",
  "/dashboard/reports",
  "/dashboard/conciliacao",
];

export function AreaTint({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isFinance = FINANCE_PREFIXES.some((p) => pathname.startsWith(p));
  return (
    <div
      className={`app-texture relative min-h-full p-6 lg:p-12 space-y-12 pb-32 lg:pb-12 transition-colors ${isFinance ? "bg-[#e9f4f0]" : "bg-surface"}`}
      style={{
        backgroundImage: `radial-gradient(680px 380px at 100% -8%, ${isFinance ? "rgba(45,212,191,0.10)" : "rgba(196,181,253,0.16)"}, transparent 60%), radial-gradient(circle at 1px 1px, rgba(43,24,48,0.035) 1px, transparent 1.7px)`,
        backgroundSize: "auto, 26px 26px",
      }}
    >
      {isFinance && (
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0f766e] bg-[#ccfbef] px-3 py-1 rounded-full">
          💼 Área financeira
        </div>
      )}
      {children}
    </div>
  );
}
