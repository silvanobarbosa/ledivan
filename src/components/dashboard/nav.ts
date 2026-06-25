import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Settings,
  Users,
  CalendarDays,
  UserPlus,
  Trophy,
  BarChart3,
  Megaphone,
  PieChart,
  Scale,
  HelpCircle,
} from "lucide-react";

export type NavItem = { icon: typeof LayoutDashboard; label: string; href: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Navegação única usada pela sidebar (desktop) e pelo drawer (mobile). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Consultório",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Users, label: "Pacientes", href: "/dashboard/patients" },
      { icon: CalendarDays, label: "Agenda", href: "/dashboard/agenda" },
      { icon: PieChart, label: "Analíticos", href: "/dashboard/analiticos" },
      { icon: UserPlus, label: "Prospects", href: "/dashboard/prospects" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { icon: ArrowLeftRight, label: "Transações", href: "/dashboard/transactions" },
      { icon: BarChart3, label: "Relatórios", href: "/dashboard/reports" },
      { icon: Scale, label: "Conciliação", href: "/dashboard/conciliacao" },
      { icon: Wallet, label: "Metas", href: "/dashboard/goals" },
      { icon: Trophy, label: "Conquistas", href: "/dashboard/gamification" },
      { icon: Megaphone, label: "Divulgação", href: "/dashboard/social" },
    ],
  },
  {
    title: "Conta",
    items: [
      { icon: Settings, label: "Meu Perfil", href: "/dashboard/settings" },
      { icon: HelpCircle, label: "Ajuda", href: "/dashboard/ajuda" },
    ],
  },
];
