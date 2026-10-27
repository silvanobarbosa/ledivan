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
      // Doc 51: ordem pedida pelo dono — Dashboard, Prospecção, Cadastros, Agenda. Segue o
      // caminho natural do paciente na clínica: ele é prospectado, vira cadastro e só então
      // ocupa a agenda.
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: UserPlus, label: "Prospecção", href: "/dashboard/prospects" },
      { icon: Users, label: "Cadastros", href: "/dashboard/patients" },
      { icon: CalendarDays, label: "Agenda", href: "/dashboard/agenda" },
      // Doc 55: Receita Saúde sai do Caixa e vem para debaixo da Agenda. A emissão nasce do
      // atendimento, não do dinheiro — é a sessão realizada que vira recibo.
      { icon: Receipt, label: "Receita Saúde", href: "/dashboard/receita-saude" },
      // Doc 28: Prontuário, Contratos e Mensagens saíram do menu. Contrato vive na guia Contrato do
      // editar paciente; prontuário e mensagens continuam acessíveis pelo paciente. As rotas seguem
      // existindo (links diretos), só não aparecem mais na navegação.
    ],
  },
  {
    // Doc 63: o grupo chama "Caixa Pessoal" e o primeiro item, "Carteira". A dona lia "Caixa >
    // Pagamentos" como o lugar de lançar o pagamento de um paciente — que fica no cadastro dele.
    title: "Caixa Pessoal",
    items: [
      { icon: Banknote, label: "Carteira", href: "/dashboard/pagamentos" },
      // Doc 46: "Visão geral", "Visão financeira" e "Previsão" saíram do menu (as rotas seguem
      // existindo para links diretos / integrações; só não aparecem mais na navegação).
      { icon: ArrowLeftRight, label: "Transações", href: "/dashboard/transactions" },
      { icon: BarChart3, label: "Relatórios", href: "/dashboard/reports" },
      { icon: Scale, label: "Conciliação", href: "/dashboard/conciliacao" },
    ],
  },
  {
    title: "Conta",
    items: [
      { icon: Settings, label: "Ajustes", href: "/dashboard/settings" },
      { icon: HelpCircle, label: "Ajuda", href: "/dashboard/ajuda" },
    ],
  },
];
