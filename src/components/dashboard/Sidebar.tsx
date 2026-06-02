"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Settings,
  Users,
  CalendarDays,
  UserPlus,
  Trophy,
  ChevronRight,
  User,
  BarChart3,
  Megaphone,
  Activity,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { icon: typeof LayoutDashboard; label: string; href: string };

const therapyNav: NavItem[] = [
  { icon: Users, label: "Pacientes", href: "/dashboard/patients" },
  { icon: CalendarDays, label: "Agenda", href: "/dashboard/agenda" },
  { icon: Activity, label: "Atenção clínica", href: "/dashboard/clinico" },
  { icon: UserPlus, label: "Prospects", href: "/dashboard/prospects" },
];

const financeNav: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ArrowLeftRight, label: "Transações", href: "/dashboard/transactions" },
  { icon: BarChart3, label: "Relatórios", href: "/dashboard/reports" },
  { icon: Wallet, label: "Metas", href: "/dashboard/goals" },
  { icon: Trophy, label: "Conquistas", href: "/dashboard/gamification" },
  { icon: Megaphone, label: "Divulgação", href: "/dashboard/social" },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-6 py-3.5 rounded-[20px] font-semibold transition-all duration-200 group",
          isActive
            ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
            : "text-foreground/60 hover:bg-surface-container hover:text-primary"
        )}
      >
        <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "group-hover:text-primary")} />
        <span>{item.label}</span>
        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
      </Link>
    );
  };

  return (
    <aside className="w-72 bg-white border-r border-border hidden lg:flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <Link href="/" className="block">
          <img src="/ledivan-color.png" alt="Ledivan" className="h-14 w-auto object-contain" />
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
        <p className="px-6 pt-2 pb-1 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Consultório</p>
        {therapyNav.map(renderItem)}

        <p className="px-6 pt-5 pb-1 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Financeiro</p>
        {financeNav.map(renderItem)}

        <p className="px-6 pt-5 pb-1 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Conta</p>
        {renderItem({ icon: Settings, label: "Ajustes", href: "/dashboard/settings" })}
        {renderItem({ icon: HelpCircle, label: "Ajuda", href: "/dashboard/ajuda" })}
      </nav>

      <div className="p-6 mt-auto">
        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center border border-border">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">Terapeuta</p>
              <p className="text-xs text-foreground/40 truncate">Ledivan</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
