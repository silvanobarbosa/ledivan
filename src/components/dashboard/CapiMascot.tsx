"use client";

import { Award } from "lucide-react";

interface CapiMascotProps {
  level: number;
  xp: number;
  nextLevelXp: number;
  message?: string;
}

export function CapiMascot({ level, xp, nextLevelXp, message }: CapiMascotProps) {
  const progress = (xp / nextLevelXp) * 100;

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-br from-primary/5 to-accent/5 rounded-[48px] border border-primary/10 relative overflow-hidden group">
      {/* Background Decorative Circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />

      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="relative mb-6 flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-[32px] bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20">
            <Award className="w-12 h-12" />
          </div>
          <p className="text-sm font-semibold text-primary text-center max-w-[220px]">
            {message || "Acompanhe sua evolução no consultório."}
          </p>
        </div>

        <div className="w-full space-y-3">
          <div className="flex justify-between items-end">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em]">Nível</span>
              <p className="text-2xl font-display font-black text-primary leading-none">{level}</p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em]">XP</span>
              <p className="text-sm font-bold text-foreground/60">{xp} / {nextLevelXp}</p>
            </div>
          </div>

          <div className="h-4 w-full bg-white/50 rounded-full border border-primary/5 overflow-hidden p-1">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000 shadow-sm" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-[10px] text-center text-foreground/30 font-medium">
            Continue registrando sessões e lançamentos para evoluir.
          </p>
        </div>
      </div>
    </div>
  );
}
