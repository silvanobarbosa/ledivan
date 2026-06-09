"use client";

import { usePathname } from "next/navigation";

// Tinge o fundo da área financeira diferente da clínica — passa a sensação de
// "dois produtos em um". Clínica = creme (warm); Financeiro = verde-água (cool).
const FINANCE_PREFIXES = [
  "/dashboard/transactions",
  "/dashboard/reports",
  "/dashboard/conciliacao",
  "/dashboard/goals",
  "/dashboard/gamification",
  "/dashboard/social",
];

export function AreaTint({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isFinance = FINANCE_PREFIXES.some((p) => pathname.startsWith(p));
  return (
    <div className={`min-h-full p-6 lg:p-12 space-y-12 pb-32 lg:pb-12 transition-colors ${isFinance ? "bg-[#e9f4f0]" : "bg-surface"}`}>
      {isFinance && (
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0f766e] bg-[#ccfbef] px-3 py-1 rounded-full">
          💼 Área financeira
        </div>
      )}
      {children}
    </div>
  );
}
