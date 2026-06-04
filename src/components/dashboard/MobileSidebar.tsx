"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavList } from "./Sidebar";

/**
 * Barra lateral retrátil no mobile: botão hambúrguer no header abre um drawer
 * com o menu completo. Fecha ao clicar num link, no backdrop, no X, com Esc,
 * ou ao trocar de rota. Trava o scroll do body enquanto aberto.
 */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // fecha ao navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc + trava scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="lg:hidden p-2.5 -ml-1 rounded-2xl text-foreground/70 hover:text-primary hover:bg-surface transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`lg:hidden fixed inset-y-0 left-0 z-[70] w-[82%] max-w-xs bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <Link href="/" onClick={() => setOpen(false)}>
            <img src="/ledivan-color.png" alt="Ledivan" className="h-10 w-auto object-contain" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="p-2 rounded-2xl text-foreground/60 hover:text-primary hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-4 overflow-y-auto no-scrollbar">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
