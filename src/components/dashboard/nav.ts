import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Settings,
  Users,
  CalendarDays,
  BarChart3,
  Scale,
  HelpCircle,
  MessageCircle,
  Receipt,
  TrendingUp,
  ClipboardList,
} from "lucide-react";

export type NavItem = { icon: typeof LayoutDashboard; label: string; href: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Navegação única usada pela sidebar (desktop) e pelo drawer (mobile). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Consultório",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: CalendarDays, label: "Agenda", href: "/dashboard/agenda" },
      { icon: Users, label: "Pacientes", href: "/dashboard/patients" },
      { icon: ClipboardList, label: "Prontuário", href: "/dashboard/prontuario" },
      { icon: MessageCircle, label: "Mensagens", href: "/dashboard/mensagens" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { icon: LayoutDashboard, label: "Visão geral", href: "/dashboard/financeiro" },
      { icon: Wallet, label: "Visão financeira", href: "/dashboard/visao-financeira" },
      { icon: ArrowLeftRight, label: "Transações", href: "/dashboard/transactions" },
      { icon: TrendingUp, label: "Previsão", href: "/dashboard/previsao" },
      { icon: BarChart3, label: "Relatórios", href: "/dashboard/reports" },
      { icon: Scale, label: "Conciliação", href: "/dashboard/conciliacao" },
      { icon: Receipt, label: "Receita Saúde", href: "/dashboard/receita-saude" },
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
