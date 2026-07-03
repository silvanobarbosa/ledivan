"use client";

import { useState, useTransition } from "react";
import { Calendar, Mail, MessageCircle, Check, Plug, RefreshCw, ArrowRight, ArrowLeft, ArrowLeftRight, X } from "lucide-react";
import { setIntegration } from "./actions";
import type { Integrations, GoogleSyncMode } from "@/lib/preferences";

const MODE_LABEL: Record<GoogleSyncMode, string> = {
  pull: "O Google atualiza o Ledivan",
  push: "O Ledivan é o principal (sobrepõe o Google)",
  both: "Sincronizar ambos igualmente",
};

export function IntegrationsCard({ initial }: { initial: Integrations }) {
  const [state, setState] = useState<Integrations>(initial ?? {});
  const [pending, startTransition] = useTransition();
  const [syncModal, setSyncModal] = useState<null | "connect" | "edit">(null);

  const commit = (patch: Integrations, next: Integrations) => {
    setState(next);
    startTransition(() => setIntegration(patch));
  };

  const toggle = (key: "googleCalendar" | "gmail" | "whatsapp") => {
    const turningOn = !state[key];
    const isGoogle = key === "googleCalendar" || key === "gmail";
    // Ao conectar um serviço Google pela 1ª vez (sem direção definida), pergunta a direção.
    if (turningOn && isGoogle && !state.googleSyncMode) {
      setState((s) => ({ ...s, [key]: true }));
      setSyncModal("connect");
      return;
    }
    const next = { ...state, [key]: !state[key] };
    commit({ [key]: next[key] }, next);
  };

  const chooseMode = (mode: GoogleSyncMode) => {
    const next = { ...state, googleSyncMode: mode };
    commit({ googleCalendar: next.googleCalendar, gmail: next.gmail, googleSyncMode: mode }, next);
    setSyncModal(null);
  };

  const saveNumber = (whatsappNumber: string) => setState((s) => ({ ...s, whatsappNumber }));
  const commitNumber = () => startTransition(() => setIntegration({ whatsappNumber: state.whatsappNumber }));

  const items = [
    { key: "googleCalendar" as const, icon: Calendar, name: "Google Agenda", desc: "Sincronize suas sessões com o Google Calendar.", color: "#4285F4" },
    { key: "gmail" as const, icon: Mail, name: "Gmail", desc: "Envie lembretes e recibos por e-mail.", color: "#EA4335" },
    { key: "whatsapp" as const, icon: MessageCircle, name: "WhatsApp", desc: "Confirmações e lembretes de sessão por WhatsApp.", color: "#25D366" },
  ];

  const googleConnected = !!state.googleCalendar || !!state.gmail;

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2"><Plug className="w-5 h-5 text-primary" /> Integrações</h3>

      <div className="space-y-4">
        {items.map((it) => {
          const connected = !!state[it.key];
          return (
            <div key={it.key} className="space-y-3">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface/50 border border-border">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: it.color }}>
                  <it.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-primary">{it.name}</p>
                  <p className="text-sm text-foreground/50 leading-snug">{it.desc}</p>
                </div>
                <button onClick={() => toggle(it.key)} disabled={pending}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${connected ? "bg-[#ecfdf5] text-[#047857]" : "bg-primary text-white hover:scale-[1.02]"}`}>
                  {connected ? <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Conectado</span> : "Conectar"}
                </button>
              </div>

              {it.key === "whatsapp" && connected && (
                <div className="flex gap-2 pl-2">
                  <input value={state.whatsappNumber ?? ""} onChange={(e) => saveNumber(e.target.value)} onBlur={commitNumber}
                    placeholder="Número com DDD (ex: 11 90000-0000)"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Direção da sincronização Google */}
      {googleConnected && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe]">
          <RefreshCw className="w-5 h-5 text-[#1e40af] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#1e40af] uppercase tracking-widest">1ª sincronização</p>
            <p className="text-sm text-foreground/70">{state.googleSyncMode ? MODE_LABEL[state.googleSyncMode] : "Não definida"}</p>
          </div>
          <button onClick={() => setSyncModal("edit")} className="shrink-0 text-sm font-semibold text-[#1e40af] hover:underline">Alterar</button>
        </div>
      )}

      <p className="text-xs text-foreground/40 leading-relaxed">
        A conexão ativa a integração no app. A autorização completa (OAuth do Google e API do WhatsApp) é concluída no primeiro uso.
      </p>

      {/* Modal: direção da 1ª sincronização */}
      {syncModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setSyncModal(null)}>
          <div className="bg-white rounded-[28px] p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-bold text-primary">Direção da sincronização</h4>
              <button onClick={() => setSyncModal(null)} className="p-1.5 rounded-lg hover:bg-surface"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-foreground/60">Na primeira sincronização, como o Ledivan e o Google devem se conciliar?</p>
            <div className="space-y-2">
              <button onClick={() => chooseMode("pull")} disabled={pending} className="w-full flex items-center gap-3 text-left rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-surface/50 transition">
                <ArrowLeft className="w-5 h-5 text-[#1e40af] shrink-0" />
                <div><p className="font-semibold text-sm">O Google atualiza o Ledivan</p><p className="text-xs text-foreground/50">Traz os eventos do Google para o Ledivan.</p></div>
              </button>
              <button onClick={() => chooseMode("push")} disabled={pending} className="w-full flex items-center gap-3 text-left rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-surface/50 transition">
                <ArrowRight className="w-5 h-5 text-[#047857] shrink-0" />
                <div><p className="font-semibold text-sm">O Ledivan é o principal</p><p className="text-xs text-foreground/50">Sobrepõe o Google com a agenda do Ledivan.</p></div>
              </button>
              <button onClick={() => chooseMode("both")} disabled={pending} className="w-full flex items-center gap-3 text-left rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-surface/50 transition">
                <ArrowLeftRight className="w-5 h-5 text-primary shrink-0" />
                <div><p className="font-semibold text-sm">Sincronizar ambos igualmente</p><p className="text-xs text-foreground/50">Une os eventos dos dois lados.</p></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
