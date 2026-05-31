import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  title: string;
  description: string | null;
  type: string;
}

const badgeConfig: Record<string, { icon: string }> = {
  first_transaction: { icon: "🎯" },
  goal_met: { icon: "💰" },
  scanner_ninja: { icon: "📸" },
  voice_wizard: { icon: "🎙️" },
  financial_guru: { icon: "🧘" },
  default: { icon: "🏆" },
};

export function Achievements({ userAchievements = [] }: { userAchievements?: any[] }) {
  const allBadges = [
    { type: "first_transaction", title: "Primeiro Passo", description: "Primeiro registro" },
    { type: "goal_met", title: "Poupador", description: "Meta atingida" },
    { type: "scanner_ninja", title: "Scanner Ninja", description: "3 notas lidas" },
    { type: "voice_wizard", title: "Mago da Voz", description: "Gasto via Telegram" },
    { type: "financial_guru", title: "Guru Financeiro", description: "Meta + 2 conquistas" },
  ];

  return (
    <div className="p-8 bg-white rounded-[40px] shadow-sm border border-border space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Conquistas</h3>
        <span className="text-sm font-medium text-foreground/40">
          {userAchievements.length} de {allBadges.length} desbloqueadas
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {allBadges.map((badge) => {
          const isUnlocked = userAchievements.some(a => a.type === badge.type);
          const config = badgeConfig[badge.type] || badgeConfig.default;
          
          return (
            <div 
              key={badge.type}
              className={cn(
                "p-4 rounded-3xl border flex flex-col items-center text-center space-y-2 transition-all",
                isUnlocked 
                  ? "bg-white border-secondary shadow-sm scale-100" 
                  : "bg-surface border-border opacity-50 grayscale scale-95"
              )}
            >
              <div className="text-3xl mb-1">{config.icon}</div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">{badge.title}</h4>
              <p className="text-[10px] text-foreground/60 leading-tight">{badge.description}</p>
            </div>
          );
        })}
      </div>

      <div className="pt-4">
        <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-1000" 
            style={{ width: `${(userAchievements.length / allBadges.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
