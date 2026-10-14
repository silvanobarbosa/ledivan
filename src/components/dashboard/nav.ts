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
  Receipt,
  TrendingUp,
  Banknote,
  UserPlus,
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
      { icon: Users, label: "Cadastros", href: "/dashboard/patients" },
      { icon: UserPlus, label: "Prospecção", href: "/dashboard/prospects" },
      // Doc 28: Prontuário, Contratos e Mensagens saíram do menu. Contrato vive na guia Contrato do
      // editar paciente; prontuário e mensagens continuam acessíveis pelo paciente. As rotas seguem
      // existindo (links diretos), só não aparecem mais na navegação.
    ],
  },
  {
    title: "Caixa",
    items: [
      { icon: Banknote, label: "Pagamentos", href: "/dashboard/pagamentos" },
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
