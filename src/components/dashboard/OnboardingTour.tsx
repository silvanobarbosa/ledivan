"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, CalendarDays, Activity, Wallet, HeartHandshake, Settings, X, ArrowRight, ArrowLeft, Sparkles, HelpCircle,
} from "lucide-react";

const KEY = "ledivan_onboarded_v1";

type Step = { icon: typeof Users; title: string; text: string; href?: string; cta?: string };

const STEPS: Step[] = [
  { icon: Sparkles, title: "Bem-vindo(a) ao Ledivan!", text: "Em 1 minuto te mostro onde fica cada coisa. Você pode refazer este tour quando quiser pela Ajuda." },
  { icon: Users, title: "Pacientes", text: "Cadastre pacientes, veja histórico, prontuário, sessões e pagamentos de cada um. O botão 'Novo paciente' fica no topo.", href: "/dashboard/patients", cta: "Ver pacientes" },
  { icon: CalendarDays, title: "Agenda", text: "Grade semanal estilo Google Calendar. Clique numa sessão para mudar o status (realizada, cancelada...) ou entrar na sala de vídeo.", href: "/dashboard/agenda", cta: "Abrir agenda" },
  { icon: Activity, title: "Atenção clínica", text: "Mostra os pacientes que merecem um olhar agora: risco de falta, escala em alerta, humor baixo ou pagamento atrasado.", href: "/dashboard/clinico", cta: "Ver alertas" },
  { icon: HeartHandshake, title: "Espaço do Paciente", text: "Dentro de cada paciente, a aba 'Espaço' tem tarefas (lição de casa com foto/áudio), diário de humor e escalas (PHQ-9/GAD-7). Tudo por link enviado ao paciente." },
  { icon: Wallet, title: "Financeiro", text: "Transações, relatórios mês a mês, metas. Pagamentos de sessão podem virar receita automaticamente (você decide).", href: "/dashboard/transactions", cta: "Ver financeiro" },
  { icon: Settings, title: "Ajustes e integrações", text: "Conecte seu WhatsApp (QR), Telegram, e-mail próprio e Google Meet. Crie seu link de autoagendamento. Tudo em Ajustes.", href: "/dashboard/settings", cta: "Abrir ajustes" },
  { icon: HelpCircle, title: "Ajuda sempre à mão", text: "Dúvidas? Use o menu 'Ajuda' ou o ícone (i) ao lado dos campos. Bom trabalho!", href: "/dashboard/ajuda", cta: "Central de ajuda" },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tour") === "1" || !localStorage.getItem(KEY)) setOpen(true);
    } catch {}
    const handler = () => { setI(0); setOpen(true); };
    window.addEventListener("ledivan-open-tour", handler);
    return () => window.removeEventListener("ledivan-open-tour", handler);
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem(KEY, "1"); } catch {}
  }

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div className="bg-white rounded-[28px] w-full max-w-md p-7 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface transition" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <step.icon className="w-7 h-7" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-primary">{step.title}</h2>
        <p className="mt-2 text-foreground/70 leading-relaxed">{step.text}</p>

        {step.href && (
          <Link href={step.href} onClick={close} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
            {step.cta} <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-6">
          {STEPS.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-primary" : "w-1.5 bg-foreground/20"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/50 disabled:opacity-0">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          {last ? (
            <button onClick={close} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm">Começar</button>
          ) : (
            <button onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))} className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-1">
              Próximo <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
