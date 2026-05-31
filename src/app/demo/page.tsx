"use client";

import { Suspense } from "react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { HeaderSearch } from "@/components/dashboard/HeaderSearch";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BottomNavBar } from "@/components/dashboard/BottomNavBar";
import Link from "next/link";
import { 
  Wallet, 
  TrendingUp, 
  Target, 
  Sparkles,
  Bell,
  Plus,
  ArrowUpRight,
  Trophy,
  Flame,
  CheckCircle2,
  Lock,
  ChevronRight,
  Zap
} from "lucide-react";

// Mock Data Expandida para a Demo
const mockTransactions = [
  { id: "1", description: "Supermercado Capi-Pão", amount: "342.50", date: new Date(), type: "expense", category: { name: "Alimentação", color: "#FF7043" } },
  { id: "2", description: "Salário Mensal", amount: "6500.00", date: new Date(Date.now() - 86400000), type: "income", category: { name: "Salário", color: "#66BB6A" } },
  { id: "3", description: "Assinatura Netflix", amount: "55.90", date: new Date(Date.now() - 172800000), type: "expense", category: { name: "Lazer", color: "#AB47BC" } },
  { id: "4", description: "Uber para o Trabalho", amount: "22.50", date: new Date(Date.now() - 259200000), type: "expense", category: { name: "Transporte", color: "#42A5F5" } },
];

const mockGoals = [
  { title: "Reserva de Emergência", current: 8500, target: 15000, color: "bg-primary" },
  { title: "Viagem para o Rio", current: 1200, target: 3000, color: "bg-secondary" },
];

const dailyMissions = [
  { title: "Sincronizar Bancos", xp: 50, completed: true },
  { title: "Scanear 1 Recibo", xp: 100, completed: false },
  { title: "Ver Insights da IA", xp: 30, completed: true },
];

export default function DemoPage() {
  return (
    <div className="flex min-h-screen bg-surface selection:bg-primary selection:text-white font-sans">
      {/* Sidebar (Desktop) */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 lg:h-24 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <Link href="/" className="lg:hidden flex items-center gap-2 group">
              <span className="material-symbols-outlined text-primary text-3xl group-hover:rotate-12 transition-transform">savings</span>
              <span className="font-display text-xl text-primary font-bold">capicash</span>
            </Link>
            <div className="hidden lg:block flex-1">
              <Suspense fallback={<div className="flex-1 h-12 bg-surface rounded-2xl animate-pulse" />}>
                <div className="flex items-center gap-8">
                  <HeaderSearch />
                  <nav className="hidden xl:flex items-center gap-6">
                    {["Metodologia", "Funcionalidades", "Segurança"].map((item) => (
                      <Link 
                        key={item} 
                        href={`/#${item.toLowerCase()}`} 
                        className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors uppercase tracking-widest"
                      >
                        {item}
                      </Link>
                    ))}
                  </nav>
                </div>
              </Suspense>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4 ml-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary/10 rounded-full border border-secondary/20">
              <Flame className="w-4 h-4 text-secondary fill-secondary" />
              <span className="text-sm font-bold text-secondary">7 Dias</span>
            </div>
            <div className="p-2 lg:p-3 bg-white border border-border rounded-2xl text-foreground/60 cursor-pointer hover:bg-surface transition-colors">
              <Bell className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-12 pb-32 lg:pb-12">
          
          {/* Gamification Hero Section */}
          <section id="demo-dashboard" className="bg-primary rounded-[48px] p-8 lg:p-12 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              <Trophy className="w-64 h-64" />
            </div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-bold border border-white/20">
                  <Zap className="w-3 h-3 text-secondary-container" />
                  Jornada Capivara Mestre
                </div>
                <h2 className="text-4xl lg:text-6xl font-display font-bold leading-tight">
                  Nível <span className="text-secondary-container">12</span>
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold">
                    <span>XP para Nível 13</span>
                    <span>850 / 1000</span>
                  </div>
                  <div className="h-4 w-full bg-white/10 rounded-full overflow-hidden border border-white/10 p-1">
                    <div className="h-full bg-secondary-container rounded-full w-[85%] shadow-[0_0_15px_rgba(63,255,139,0.5)]" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-[32px] border border-white/10 text-center">
                  <p className="text-3xl font-display font-bold">42</p>
                  <p className="text-xs font-bold text-white/60 uppercase mt-1">Conquistas</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-[32px] border border-white/10 text-center">
                  <p className="text-3xl font-display font-bold">128</p>
                  <p className="text-xs font-bold text-white/60 uppercase mt-1">Missões</p>
                </div>
              </div>
            </div>
          </section>

          {/* Missions & Goals Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
            
            <div className="xl:col-span-2 space-y-12">
              {/* Daily Missions */}
              <div className="p-10 bg-white rounded-[48px] border border-border space-y-8 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-display font-bold text-primary">Missões Diárias</h3>
                  <span className="text-xs font-bold text-foreground/40">Reseta em 4h 20m</span>
                </div>
                <div className="space-y-4">
                  {dailyMissions.map((mission, i) => (
                    <div key={i} className={`p-6 rounded-[28px] border transition-all flex items-center justify-between group ${mission.completed ? 'bg-secondary/5 border-secondary/20' : 'bg-surface border-border hover:border-primary/30'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${mission.completed ? 'bg-secondary text-white' : 'bg-white border border-border text-foreground/20'}`}>
                          {mission.completed ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                        <div>
                          <p className={`font-bold ${mission.completed ? 'text-secondary line-through' : 'text-primary'}`}>{mission.title}</p>
                          <p className="text-xs font-bold text-foreground/40">+{mission.xp} XP</p>
                        </div>
                      </div>
                      {!mission.completed && (
                        <button className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          Fazer Agora
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <RecentTransactions id="demo-transactions" transactions={mockTransactions} />
            </div>

            <div className="space-y-12">
              {/* Next Unlocks */}
              <div id="demo-gamification" className="p-8 bg-surface-container-high rounded-[40px] border border-primary/5 space-y-6">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Próximos Desbloqueios
                </h3>
                <div className="space-y-4">
                  {[
                    { level: 13, title: "Selo de Investidor Mestre", icon: <Lock className="w-4 h-4" /> },
                    { level: 15, title: "Capi-Insights Avançados", icon: <Lock className="w-4 h-4" /> },
                    { level: 20, title: "Modo Ultra Zen", icon: <Lock className="w-4 h-4" /> },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white/50 rounded-2xl border border-white">
                      <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center font-bold text-primary text-sm">
                        {item.level}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-foreground/60">{item.title}</p>
                      </div>
                      {item.icon}
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals Progress */}
              <div id="demo-goals" className="p-8 bg-white rounded-[40px] border border-border space-y-8 shadow-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-primary">Metas Ativas</h3>
                  <button className="text-primary font-bold text-xs">Ver todas</button>
                </div>
                <div className="space-y-6">
                  {mockGoals.map((goal, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-foreground/60">{goal.title}</span>
                        <span className="text-primary">{Math.round((goal.current / goal.target) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                        <div className={`h-full ${goal.color} rounded-full`} style={{ width: `${(goal.current / goal.target) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Navigation Mobile */}
      <BottomNavBar />
    </div>
  );
}
