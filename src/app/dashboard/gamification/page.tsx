import { Trophy, Zap, CheckCircle2, Lock, Flame, Star, Target, ArrowUpRight } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { HeaderSearch } from "@/components/dashboard/HeaderSearch";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const dailyMissions = [
  { title: "Sincronizar Bancos", xp: 50, completed: true },
  { title: "Scanear 1 Recibo", xp: 100, completed: false },
  { title: "Ver Insights da IA", xp: 30, completed: true },
  { title: "Definir Meta de Economia", xp: 150, completed: false },
];

export default function GamificationPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">
          Sua <span className="text-primary">Evolução</span>
        </h2>
        <p className="text-lg text-foreground/40 font-medium">
          Acompanhe conquistas na gestão do consultório e das finanças.
        </p>
      </section>

      {/* Level Hero Section */}
      <section className="bg-primary rounded-[48px] p-10 lg:p-16 text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
          <Trophy className="w-64 h-64" />
        </div>
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs font-bold border border-white/20">
              <Zap className="w-3 h-3 text-secondary-container" />
              Nível: Gestor(a) Consciente
            </div>
            <div className="space-y-2">
              <h3 className="text-6xl lg:text-8xl font-display font-bold leading-tight">
                Nível <span className="text-secondary-container">12</span>
              </h3>
              <p className="text-white/60 font-bold uppercase tracking-widest text-sm">850 / 1000 XP para o Nível 13</p>
            </div>
            <div className="h-6 w-full bg-white/10 rounded-full overflow-hidden border border-white/10 p-1.5 shadow-inner">
              <div className="h-full bg-secondary-container rounded-full w-[85%] shadow-[0_0_20px_rgba(63,255,139,0.5)] transition-all duration-1000" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 text-center group hover:bg-white/20 transition-all">
              <Flame className="w-8 h-8 text-secondary-container mx-auto mb-2 fill-current" />
              <p className="text-4xl font-display font-bold">7</p>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Dias Seguidos</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 text-center group hover:bg-white/20 transition-all">
              <Star className="w-8 h-8 text-secondary-container mx-auto mb-2 fill-current" />
              <p className="text-4xl font-display font-bold">42</p>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Conquistas</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Missions Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="p-10 bg-white rounded-[48px] border border-border space-y-10 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-display font-bold text-primary">Missões de Hoje</h3>
              <div className="px-4 py-2 bg-surface rounded-full text-xs font-bold text-foreground/40">
                Reseta em 04:12:45
              </div>
            </div>
            <div className="space-y-4">
              {dailyMissions.map((mission, i) => (
                <div key={i} className={`p-8 rounded-[32px] border transition-all flex items-center justify-between group ${mission.completed ? 'bg-secondary/5 border-secondary/20 opacity-60' : 'bg-surface border-border hover:border-primary/40 hover:shadow-md'}`}>
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${mission.completed ? 'bg-secondary text-white' : 'bg-white border border-border text-foreground/20'}`}>
                      {mission.completed ? <CheckCircle2 className="w-7 h-7" /> : <div className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />}
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${mission.completed ? 'text-secondary line-through' : 'text-primary'}`}>{mission.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Zap className="w-3 h-3 text-secondary" />
                        <span className="text-xs font-bold text-foreground/40">+{mission.xp} XP</span>
                      </div>
                    </div>
                  </div>
                  {!mission.completed && (
                    <button className="px-8 py-3 bg-primary text-white rounded-2xl text-xs font-bold hover:scale-105 transition-transform active:scale-95">
                      Começar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Achievement Grid */}
          <div className="p-10 bg-white rounded-[48px] border border-border space-y-8 shadow-sm">
            <h3 className="text-2xl font-display font-bold text-primary">Galeria de Troféus</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { emoji: "🌱", label: "Semeador", desc: "1ª Meta" },
                { emoji: "🛡️", label: "Inabalável", desc: "Reserva 50%" },
                { emoji: "📈", label: "Mestre", desc: "1 ano +10%" },
                { emoji: "🌿", label: "Equilíbrio", desc: "Sem dívidas" },
                { emoji: "🔥", label: "Focado", desc: "15 dias" },
                { emoji: "💰", label: "Poupador", desc: "R$ 10k" },
                { emoji: "🚀", label: "Explorador", desc: "Todas áreas" },
                { emoji: "💎", label: "Precioso", desc: "Saldos Positivos" },
              ].map((a, i) => (
                <div key={i} className="p-6 bg-surface rounded-[32px] border border-border flex flex-col items-center text-center gap-3 hover:border-primary/30 transition-all group">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm border border-border group-hover:scale-110 transition-transform group-hover:shadow-lg">
                    {a.emoji}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-primary">{a.label}</p>
                    <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progression Sidebar */}
        <div className="space-y-8">
          <div className="p-8 bg-surface-container-high rounded-[40px] border border-primary/10 space-y-8">
            <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <Target className="w-5 h-5" />
              Próximos Desbloqueios
            </h3>
            <div className="space-y-6">
              {[
                { level: 13, title: "Selo de Investidor Mestre", desc: "Novas medalhas para seu perfil", locked: true },
                { level: 15, title: "Insights Avançados", desc: "Análise profunda de tendências", locked: true },
                { level: 20, title: "Customização Total", desc: "Personalização completa da interface", locked: true },
              ].map((item, i) => (
                <div key={i} className="relative pl-12 border-l-2 border-primary/10 pb-8 last:pb-0">
                  <div className="absolute left-[-13px] top-0 w-6 h-6 bg-white border-2 border-primary/20 rounded-full flex items-center justify-center">
                    {item.locked ? <Lock className="w-3 h-3 text-foreground/20" /> : <div className="w-2 h-2 bg-primary rounded-full" />}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary">Nível {item.level}</p>
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="text-xs text-foreground/40">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 bg-secondary/5 rounded-[40px] border border-secondary/20 space-y-4">
            <h4 className="font-bold text-secondary flex items-center gap-2">
              <Zap className="w-4 h-4 fill-current" />
              Dica de Ouro
            </h4>
            <p className="text-sm text-secondary/80 leading-relaxed font-medium">
              Conclua 3 missões hoje para ganhar um bônus de **100 XP** e acelerar sua jornada para o Nível 13!
            </p>
            <button className="w-full py-4 bg-secondary text-white rounded-2xl font-bold text-xs shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-transform">
              Ver Missões Extras
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
