"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

// Tutorial guiado, passo a passo. Cada passo aponta para uma tela real das contas de
// demonstração (Dr. Sócrates = terapeuta, Srta. Dionísia = paciente). O primeiro passo abre a
// conta demo do terapeuta (/demo, que faz o login somente-leitura); os demais linkam telas.
type Passo = { lado: "terapeuta" | "paciente"; t: string; d: string; href: string; cta: string };

const PASSOS: Passo[] = [
  { lado: "terapeuta", t: "Entre como terapeuta", d: "Abra a conta de demonstração do Dr. Sócrates. É somente leitura: você navega por tudo, sem alterar nada.", href: "/demo", cta: "Abrir o consultório" },
  { lado: "terapeuta", t: "Veja o painel", d: "No Dashboard: prospecção, pacientes atuais, queixa principal, pagamentos e presença — o resumo do consultório.", href: "/dashboard", cta: "Abrir Dashboard" },
  { lado: "terapeuta", t: "Explore os pacientes", d: "Abra a lista e a ficha de um paciente: dados, prontuário, atividades, materiais, sessões, financeiro e linha do tempo.", href: "/dashboard/patients", cta: "Abrir Pacientes" },
  { lado: "terapeuta", t: "Passe pela agenda", d: "Recorrências, reservas, pacotes numerados, devolutivas e aniversários. Cada agendamento nasce como reserva.", href: "/dashboard/agenda", cta: "Abrir Agenda" },
  { lado: "terapeuta", t: "Olhe o financeiro", d: "Pagamentos (pagos e em aberto), previsão de ganhos, relatórios e a Receita Saúde com os campos prontos.", href: "/dashboard/pagamentos", cta: "Abrir Pagamentos" },
  { lado: "paciente", t: "Agora, o outro lado", d: "Abra o app da paciente Srta. Dionísia. É o que o paciente vê: próxima sessão, tarefas, humor, escalas, diário, metas e pagamento.", href: "/paciente-demo", cta: "Abrir o app do paciente" },
  { lado: "paciente", t: "Feche o ciclo", d: "Perceba como o que o terapeuta liga de um lado aparece do outro em tempo real — tarefas enviadas, humor registrado, metas visíveis.", href: "/paciente-demo", cta: "Rever o app do paciente" },
];

export default function TutorialPage() {
  const [feitos, setFeitos] = useState<Set<number>>(new Set());
  const marcar = (i: number) => setFeitos((s) => new Set(s).add(i));
  const pct = Math.round((feitos.size / PASSOS.length) * 100);

  return (
    <div className="bg-ornaments min-h-screen">
      <header className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <Link href="/como-funciona" className="text-sm text-[color:var(--muted-foreground)] hover:text-ink transition">Como funciona →</Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-16">
        <div className="text-center pt-6 pb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.08)] bg-white/70 px-3 py-1 text-xs font-medium text-[color:var(--brand-eggplant)] backdrop-blur">Tutorial guiado</span>
          <h1 className="font-display mt-4 text-3xl md:text-4xl font-medium text-[color:var(--brand-eggplant)]">Conheça o sistema em 7 passos</h1>
          <p className="mt-3 text-[color:var(--muted-foreground)]">Abra cada tela numa nova aba e volte aqui. Vai dos dois lados: terapeuta e paciente.</p>
          {/* progresso */}
          <div className="mt-6 max-w-sm mx-auto">
            <div className="h-2 rounded-full bg-black/5 overflow-hidden">
              <div className="h-full bg-[color:var(--brand-eggplant)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{feitos.size} de {PASSOS.length} · {pct}%</p>
          </div>
        </div>

        <ol className="space-y-4">
          {PASSOS.map((p, i) => {
            const feito = feitos.has(i);
            return (
              <li key={i} className={`glass-card p-5 transition ${feito ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 h-9 w-9 rounded-full grid place-items-center text-sm font-bold ${feito ? "bg-green-500 text-white" : "bg-[color:var(--brand-eggplant)] text-cream"}`}>
                    {feito ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${p.lado === "terapeuta" ? "bg-[rgba(139,92,246,0.12)] text-[color:var(--accent-violet)]" : "bg-[#dbeafe] text-[#1e40af]"}`}>
                        {p.lado}
                      </span>
                      <h3 className="font-display text-lg font-medium text-[color:var(--brand-eggplant)]">{p.t}</h3>
                    </div>
                    <p className="mt-1.5 text-sm text-[color:var(--muted-foreground)]">{p.d}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <a href={p.href} target="_blank" rel="noopener" onClick={() => marcar(i)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-eggplant)] px-4 py-2 text-sm font-medium text-cream hover:bg-[color:var(--brand-eggplant-soft)] transition">
                        {p.cta} ↗
                      </a>
                      {!feito && (
                        <button onClick={() => marcar(i)} className="text-xs text-[color:var(--muted-foreground)] hover:text-ink transition">marcar como visto</button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {pct === 100 && (
          <div className="glass-card-lg p-8 mt-6 text-center">
            <p className="text-2xl">🎉</p>
            <h2 className="font-display mt-2 text-2xl font-medium text-[color:var(--brand-eggplant)]">Você viu o caminho completo!</h2>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Do primeiro contato ao recebimento — e o app do paciente do outro lado.</p>
            <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3 text-sm font-medium text-cream hover:bg-[color:var(--brand-eggplant-soft)] transition">Criar minha conta</Link>
          </div>
        )}
      </main>
    </div>
  );
}
