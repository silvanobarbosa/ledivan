"use client";

import { useState, useTransition } from "react";
import { Video } from "lucide-react";
import { setMeetingProvider } from "./actions";

export function MeetingCard({ initial, hasGoogle }: { initial: "jitsi" | "meet"; hasGoogle: boolean }) {
  const [provider, setProvider] = useState<"jitsi" | "meet">(initial);
  const [, startTransition] = useTransition();

  const choose = (p: "jitsi" | "meet") => {
    setProvider(p);
    startTransition(() => setMeetingProvider(p));
  };

  return (
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Video className="w-6 h-6" /></div>
        <div className="flex-1">
          <h4 className="font-bold text-primary">Atendimento por vídeo</h4>
          <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
            Escolha o provedor das sessões online. O link é gerado ao marcar a sessão como online.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => choose("jitsi")}
          className={`p-4 rounded-2xl border text-left transition ${provider === "jitsi" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-surface"}`}
        >
          <p className="font-bold text-primary">Jitsi</p>
          <p className="text-xs text-foreground/50 mt-1">Sala instantânea, sem configuração. Padrão.</p>
        </button>
        <button
          onClick={() => choose("meet")}
          className={`p-4 rounded-2xl border text-left transition ${provider === "meet" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:bg-surface"}`}
        >
          <p className="font-bold text-primary">Google Meet</p>
          <p className="text-xs text-foreground/50 mt-1">Cria evento no seu Google Agenda com link Meet.</p>
        </button>
      </div>

      {provider === "meet" && !hasGoogle && (
        <p className="text-sm text-[#b45309] bg-[#fffbeb] rounded-xl px-4 py-3">
          Para usar o Meet, entre no app com sua conta <strong>Google</strong> (e autorize o acesso ao Agenda). Sem isso, as sessões online usam Jitsi automaticamente.
        </p>
      )}
    </div>
  );
}
