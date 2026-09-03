"use client";

import { useEffect, useState } from "react";

type AppItem = { key: string; name: string; description: string; version: string; apkUrl: string };

const ICON: Record<string, string> = { terapeuta: "🩺", paciente: "🌿" };

export function AppsSection() {
  const [apps, setApps] = useState<AppItem[] | null>(null);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.json())
      .then((d) => setApps(d.apps ?? []))
      .catch(() => setApps([]));
  }, []);

  // Enquanto não há APK publicado, a seção some (nada de link quebrado na landing).
  if (!apps || apps.length === 0) return null;

  return (
    <section id="apps" className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Aplicativos</p>
        <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-tight">
          Leve o consultório no bolso.
        </h2>
        <p className="mt-4 text-[color:var(--muted-foreground)]">
          Dois apps Android: um para você, outro para seus pacientes. Baixe direto — sem loja, sem espera.
        </p>
      </div>

      <div className="mt-14 grid sm:grid-cols-2 gap-6">
        {apps.map((a) => (
          <div key={a.key} className="glass-card p-8 h-full flex flex-col">
            <div className="h-14 w-14 rounded-2xl bg-white inline-flex items-center justify-center text-3xl shadow-[var(--shadow-glass)]">
              {ICON[a.key] ?? "📱"}
            </div>
            <p className="font-display mt-5 text-2xl font-medium text-[color:var(--brand-eggplant)]">{a.name}</p>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed flex-1">{a.description}</p>
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <a
                href={a.apkUrl}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Baixar para Android
              </a>
              {a.version && (
                <span className="text-xs text-[color:var(--muted-foreground)]">versão {a.version}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-[color:var(--muted-foreground)] max-w-xl mx-auto">
        Instalação direta (APK). No primeiro download o Android pede permissão para instalar fora da Play Store — é normal.
        Em iPhone, use o Ledivan pelo navegador.
      </p>
    </section>
  );
}
