"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Banknote,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNavBar() {
  const pathname = usePathname();

  const navItems = [
    { icon: Users, label: "Cadastros", href: "/dashboard/patients" },
    { icon: CalendarDays, label: "Agenda", href: "/dashboard/agenda" },
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    // Doc 63: no celular o item ainda dizia "Caixa" e abria Transações, enquanto a sidebar já
    // levava a "Carteira" (ver nav.ts). Mesmo nome, mesmo destino nos dois lugares.
    { icon: Banknote, label: "Carteira", href: "/dashboard/pagamentos" },
    { icon: Settings, label: "Ajustes", href: "/dashboard/settings" },
  ];

  return (
    <nav className="print:hidden lg:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-surface-container shadow-lg border-t border-outline-variant rounded-t-[32px] backdrop-blur-md bg-white/80">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const isHash = item.href.startsWith("#");
        const LinkComponent = isHash ? 'a' : Link;

        return (
          <LinkComponent
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center p-2 transition-all duration-300 ease-out gap-1",
              isActive 
                ? "text-primary scale-110" 
                : "text-outline hover:text-primary"
            )}
          >
            <div className={cn(
              "p-2 rounded-full transition-colors",
              isActive ? "bg-primary-container text-on-primary-container" : ""
            )}>
              <item.icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </LinkComponent>
        );
      })}
    </nav>
  );
}
