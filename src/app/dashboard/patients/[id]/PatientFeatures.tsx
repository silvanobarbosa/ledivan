"use client";

import { useEffect, useState, useTransition } from "react";
import { getPatientFeatureConfig, setPatientOverride } from "./patient-features-actions";
import type { FeatureKey } from "@/lib/features";

type Cfg = { perPatient: { key: FeatureKey; label: string }[]; overrides: Record<string, boolean> };

export function PatientFeatures({ patientId }: { patientId: string }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { getPatientFeatureConfig(patientId).then(setCfg); }, [patientId]);
  if (!cfg || cfg.perPatient.length === 0) return null;

  const toggle = (k: FeatureKey, v: boolean) => {
    setCfg((c) => (c ? { ...c, overrides: { ...c.overrides, [k]: v } } : c));
    start(async () => { await setPatientOverride(patientId, k, v); });
  };

  return (
    <div className="glass-card rounded-2xl p-4 mb-4">
      <p className="font-bold text-primary text-sm">Recursos deste paciente</p>
      <p className="text-xs text-foreground/40 mb-3">Recursos que você deixou &quot;por paciente&quot; nas Configurações.</p>
      <div className="space-y-2">
        {cfg.perPatient.map((f) => (
          <label key={f.key} className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm text-foreground">{f.label}</span>
            <input type="checkbox" checked={!!cfg.overrides[f.key]} onChange={(e) => toggle(f.key, e.target.checked)} disabled={pending} className="accent-primary w-5 h-5" />
          </label>
        ))}
      </div>
    </div>
  );
}
