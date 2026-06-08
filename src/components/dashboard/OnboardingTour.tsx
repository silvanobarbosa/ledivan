"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, CalendarDays, Activity, Wallet, HeartHandshake, Settings, X, ArrowRight, ArrowLeft, Sparkles, HelpCircle,
} from "lucide-react";

const KEY = "ledivan_onboarded_v2";

type Step = { icon: typeof Users; title: string; text: string; href?: string; cta?: string; phase?: string };

const STEPS: Step[] = [
  { icon: Sparkles, title: "Bem-vindo(a) ao Ledivan!", text: "Vou te guiar de ponta a ponta: primeiro a parte CLÍNICA (atender), depois a FINANCEIRA (receber). Pode refazer este tour quando quiser pela Ajuda." },

  // ——— Parte clínica ———
  { phase: "Parte clínica", icon: Users, title: "1. Cadastre o paciente", text: "Em 'Pacientes' → 'Novo paciente': nome, contato, valor da sessão, modalidade (online/presencial/misto) e etiquetas. É o ponto de partida.", href: "/dashboard/patients", cta: "Ver pacientes" },
  { phase: "Parte clínica", icon: Users, title: "2. A ficha do paciente", text: "Ao abrir um paciente você vê 4 cards no topo: Reservadas, Agendadas futuras, Status de crédito e Realizadas. Abas: Dados, Prontuário, Atividades, Sessões, Financeiro e Linha do tempo." },
  { phase: "Parte clínica", icon: CalendarDays, title: "3. Agende ou reserve", text: "Na Agenda (grade semanal) crie a sessão. Pode 'Confirmar' ou 'Só reservar' (amarelo) — e 'Reserva recorrente' (azul) cria toda semana até a data. Cores: roxo=agendada, verde=realizada, vermelho=não realizada.", href: "/dashboard/agenda", cta: "Abrir agenda" },
  { phase: "Parte clínica", icon: HeartHandshake, title: "4. Atenda", text: "No horário, clique 'Atender': abre a sala de vídeo (Jitsi) + o prontuário lado a lado. Registre a evolução e, ao Finalizar, escolha se a sessão será cobrada." },
  { phase: "Parte clínica", icon: Activity, title: "5. Atividades do paciente", text: "Na aba 'Atividades': tarefas (lição de casa com foto/áudio), diário de humor e escalas PHQ-9/GAD-7 — tudo por link enviado ao paciente. O Prontuário reúne a evolução." },
  { phase: "Parte clínica", icon: Activity, title: "6. Atenção clínica", text: "O painel 'Atenção clínica' destaca quem precisa de olhar agora: risco de falta, escala em alerta ou humor baixo.", href: "/dashboard/clinico", cta: "Ver alertas" },

  // ——— Parte financeira ———
  { phase: "Parte financeira", icon: Wallet, title: "7. Financeiro do paciente", text: "Na aba 'Financeiro' do paciente: contadores (sessões previstas, crédito, valor), o fluxo (cada sessão cobrada desconta, cada pagamento soma) e 'Ajustes' (recorrência, valor com vigência, incluir pacote)." },
  { phase: "Parte financeira", icon: Wallet, title: "8. Pacotes e créditos", text: "Inclua pacotes numerados (P1, P2...). Cada sessão realizada+cobrar abate 1. 'Gestão de Créditos' lista todos por saldo; o dashboard avisa quem está com pacote acabando.", href: "/dashboard/creditos", cta: "Gestão de créditos" },
  { phase: "Parte financeira", icon: Wallet, title: "9. Caixa do consultório", text: "Transações, Relatórios mês a mês e Metas. Ao registrar um pagamento, ele pode virar receita no financeiro automaticamente (você decide).", href: "/dashboard/transactions", cta: "Ver financeiro" },
  { phase: "Parte financeira", icon: Settings, title: "10. Integrações", text: "Conecte WhatsApp (QR), Telegram, e-mail próprio e Google Meet. Registre gastos por mensagem ou foto de recibo (IA). Crie seu link de autoagendamento.", href: "/dashboard/settings", cta: "Abrir ajustes" },

  { icon: HelpCircle, title: "Pronto! 🌿", text: "Você viu o caminho completo: do cadastro ao recebimento. Dúvidas? Menu 'Ajuda' ou o ícone (i) nos campos.", href: "/dashboard/ajuda", cta: "Central de ajuda" },
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

        {step.phase && (
          <span className={`inline-block mb-3 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${step.phase === "Parte clínica" ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#eff6ff] text-[#1e40af]"}`}>{step.phase}</span>
        )}
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <step.icon className="w-7 h-7" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-primary">{step.title}</h2>
        <p className="mt-2 text-foreground/70 leading-relaxed">{step.text}</p>

        {step.href && (
          <Link
            href={step.href}
            onClick={() => setI((x) => Math.min(STEPS.length - 1, x + 1))}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
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
