"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, type NavItem } from "./nav";

/** Lista de links compartilhada entre sidebar (desktop) e drawer (mobile). */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-6 py-3.5 rounded-[20px] font-semibold transition-all duration-200 group",
          isActive
            ? "bg-primary text-white shadow-lg shadow-primary/20"
            : "text-foreground/60 hover:bg-surface-container hover:text-primary"
        )}
      >
        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "group-hover:text-primary")} />
        <span>{item.label}</span>
        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
      </Link>
    );
  };

  return (
    <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.title}>
          <p className={cn("px-6 pb-1 text-[10px] font-bold text-foreground/40 uppercase tracking-widest", i === 0 ? "pt-2" : "pt-5")}>
            {group.title}
          </p>
          {group.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="w-72 bg-white border-r border-border hidden lg:flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <Link href="/" className="block">
          <img src="/ledivan-color.png" alt="Ledivan" className="h-14 w-auto object-contain" />
        </Link>
      </div>

      <NavList />

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
