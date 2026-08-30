"use client";

import { useState, useTransition } from "react";
import { FEATURES, type FeatureKey, type FeatureMode, type FeatureModes } from "@/lib/features";
import { saveFeatureModes, saveTimerVisibility } from "./features-actions";

const OPTS: { v: FeatureMode; l: string }[] = [
  { v: "off", l: "Desligado" },
  { v: "all", l: "Todos" },
  { v: "per-patient", l: "Por paciente" },
];

export function FeaturesCard({ initial }: { initial: { modes: FeatureModes; timerShow: boolean } }) {
  const [modes, setModes] = useState<FeatureModes>(initial.modes ?? {});
  const [timerShow, setTimerShow] = useState(!!initial.timerShow);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const setMode = (key: FeatureKey, mode: FeatureMode) => {
    const next = { ...modes, [key]: mode };
    setModes(next);
    start(async () => { await saveFeatureModes(next); flash(); });
  };
  const toggleTimer = (v: boolean) => { setTimerShow(v); start(async () => { await saveTimerVisibility(v); flash(); }); };

  return (
    <section className="glass-card rounded-[28px] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-display font-bold text-primary">Recursos do paciente</h3>
        {saved && <span className="text-xs text-green-600 font-semibold">salvo ✓</span>}
      </div>
      <p className="text-sm text-foreground/50">Ligue cada recurso para <b>todos</b> os pacientes, <b>por paciente</b> (você decide no perfil de cada um) ou <b>desligado</b>.</p>

      <div className="space-y-3">
        {FEATURES.map((f) => {
          const mode = modes[f.key] ?? "off";
          return (
            <div key={f.key} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground">{f.label}</p>
                <p className="text-xs text-foreground/40">{f.desc}</p>
                {f.key === "timer" && (mode === "all" || mode === "per-patient") && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-foreground/60 cursor-pointer">
                    <input type="checkbox" checked={timerShow} onChange={(e) => toggleTimer(e.target.checked)} className="accent-primary w-4 h-4" />
                    Mostrar o cronômetro ao paciente
                  </label>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {OPTS.map((o) => (
                  <button key={o.v} onClick={() => setMode(f.key, o.v)} disabled={pending}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${mode === o.v ? "bg-primary text-white" : "bg-surface text-foreground/50 hover:bg-surface-container"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
