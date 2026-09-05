import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export const metadata = {
  title: "Como funciona — Ledivan",
  description: "O caminho completo, ponta a ponta: do primeiro contato do paciente ao recebimento — e o que o paciente vive do outro lado. Com contas de demonstração para explorar.",
};

// Jornada do TERAPEUTA (Dr. Sócrates) — cada etapa é uma tela real do sistema.
const ETAPAS = [
  { n: "01", icon: "🧲", t: "Prospecção", d: "O interessado chega pelo seu link público de agendamento ou você registra o contato. Vira um card em Prospecção, com o funil e a taxa de conversão." },
  { n: "02", icon: "🪪", t: "Cadastro", d: "Ficha completa: dados, responsável, contato de emergência, valor, forma de pagamento, recorrência e a queixa principal. O número do cadastro é gerado sozinho." },
  { n: "03", icon: "🗓️", t: "Agenda", d: "Reserve o horário por meses ou um ano. Recorrência semanal/quinzenal, pacotes numerados (1/4, 2/4…), devolutivas aos responsáveis e aniversários no calendário." },
  { n: "04", icon: "🎥", t: "Atendimento", d: "No horário, ‘Atender’ abre a sala de vídeo + o prontuário lado a lado, com cronômetro da sessão e sala de espera (o paciente avisa que chegou)." },
  { n: "05", icon: "📝", t: "Evolução", d: "Registre a evolução no prontuário. A transcrição por IA (com a sua chave) rascunha a evolução a partir do áudio da sessão." },
  { n: "06", icon: "💳", t: "Financeiro", d: "Cada sessão cobrada desconta, cada pagamento soma. Pix estático, dois quadros de pagamentos e o recibo da Receita Saúde com os campos prontos." },
  { n: "07", icon: "📈", t: "Previsão & relatórios", d: "Receita prevista dos próximos meses (agendado, pacotes, recorrência, reajustes) e relatórios do caixa mês a mês." },
];

// O que o PACIENTE (Srta. Dionísia) vive — o ‘outro lado’, no app do paciente.
const PACIENTE = [
  { icon: "🔔", t: "Lembrete", d: "Recebe o lembrete da sessão por WhatsApp e confirma num toque." },
  { icon: "🎥", t: "Sala", d: "Entra na sala de vídeo e avisa ‘cheguei’ na sala de espera." },
  { icon: "🌤️", t: "Humor & diário", d: "Registra o humor (antes/depois) e escreve no diário entre sessões." },
  { icon: "✅", t: "Tarefas & escalas", d: "Faz as tarefas de casa e responde questionários (PHQ-9, GAD-7)." },
  { icon: "🎯", t: "Metas", d: "Acompanha as metas terapêuticas e o progresso." },
  { icon: "💚", t: "Pagamento", d: "Paga pelo app por Pix e recebe o recibo." },
];

export default function ComoFuncionaPage() {
  return (
    <div className="bg-ornaments min-h-screen">
      {/* Nav */}
      <header className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-[color:var(--muted-foreground)] hover:text-ink transition">← Início</Link>
          <Link href="/tutorial" className="rounded-full border border-[rgba(43,24,48,0.12)] bg-white/60 px-4 py-2 font-medium text-ink hover:bg-white transition">Tutorial guiado</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-10 pb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.08)] bg-white/70 px-3 py-1 text-xs font-medium text-[color:var(--brand-eggplant)] backdrop-blur">
          Ponta a ponta
        </span>
        <h1 className="font-display mt-5 text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight text-[color:var(--brand-eggplant)] text-balance">
          Como funciona, do primeiro contato ao recebimento
        </h1>
        <p className="mt-5 text-lg text-[color:var(--muted-foreground)] max-w-2xl mx-auto">
          Um único caminho para atender e receber — e, do outro lado, um app que mantém o paciente próximo.
          Explore com as contas de demonstração, sem cadastrar nada.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/demo" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">
            Entrar como terapeuta (Dr. Sócrates)
          </Link>
          <Link href="/paciente-demo" className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.12)] bg-white/60 px-6 py-3.5 text-sm font-medium text-ink hover:bg-white transition">
            Ver como paciente (Srta. Dionísia)
          </Link>
        </div>
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">Contas de demonstração · somente leitura</p>
      </section>

      {/* INFOGRÁFICO — jornada do terapeuta (timeline vertical, alternada) */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-[color:var(--accent-violet)]">O lado do terapeuta</p>
          <h2 className="font-display mt-2 text-3xl md:text-4xl font-medium text-[color:var(--brand-eggplant)]">Sete passos, um fluxo só</h2>
        </div>

        <ol className="relative mx-auto max-w-3xl">
          {/* linha central */}
          <div className="absolute left-[27px] md:left-1/2 top-2 bottom-2 w-px bg-[rgba(43,24,48,0.12)] md:-translate-x-1/2" aria-hidden />
          {ETAPAS.map((e, i) => (
            <li key={e.n} className={`relative flex md:grid md:grid-cols-2 md:gap-8 items-start mb-8 ${i % 2 ? "md:[&>*:first-child]:col-start-2" : ""}`}>
              {/* nó */}
              <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 z-10">
                <div className="h-14 w-14 rounded-2xl bg-white shadow-[var(--shadow-eggplant)] border border-[rgba(43,24,48,0.06)] grid place-items-center text-2xl">{e.icon}</div>
              </div>
              {/* card (empurra pro lado alternado no desktop) */}
              <div className={`ml-20 md:ml-0 glass-card p-5 ${i % 2 ? "md:col-start-1 md:text-right md:mr-8" : "md:col-start-2 md:ml-8"}`}>
                <div className={`flex items-baseline gap-2 ${i % 2 ? "md:justify-end" : ""}`}>
                  <span className="font-display text-2xl font-medium text-[color:var(--accent-violet)] tabular-nums">{e.n}</span>
                  <h3 className="font-display text-xl font-medium text-[color:var(--brand-eggplant)]">{e.t}</h3>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{e.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* O OUTRO LADO — o paciente */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-[color:var(--accent-violet)]">O outro lado</p>
          <h2 className="font-display mt-2 text-3xl md:text-4xl font-medium text-[color:var(--brand-eggplant)]">O que o paciente vive</h2>
          <p className="mt-3 text-[color:var(--muted-foreground)] max-w-2xl mx-auto">No app do paciente, tudo o que o terapeuta liga aparece do lado de lá — em tempo real.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PACIENTE.map((p) => (
            <div key={p.t} className="glass-card p-5">
              <div className="text-2xl">{p.icon}</div>
              <h3 className="font-display mt-3 text-lg font-medium text-[color:var(--brand-eggplant)]">{p.t}</h3>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Convergência + CTA final */}
      <section className="mx-auto max-w-4xl px-6 py-14 text-center">
        <div className="glass-card-lg p-10">
          <h2 className="font-display text-3xl md:text-4xl font-medium text-[color:var(--brand-eggplant)]">Os dois lados, no mesmo lugar</h2>
          <p className="mt-3 text-[color:var(--muted-foreground)] max-w-xl mx-auto">
            O que o terapeuta registra de um lado, o paciente vê do outro. Experimente os dois — são contas de demonstração de verdade, com anos de uso, só para você navegar.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">Terapeuta — Dr. Sócrates</Link>
            <Link href="/paciente-demo" className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.12)] bg-white/60 px-6 py-3.5 text-sm font-medium text-ink hover:bg-white transition">Paciente — Srta. Dionísia</Link>
            <Link href="/tutorial" className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.12)] bg-white/60 px-6 py-3.5 text-sm font-medium text-ink hover:bg-white transition">Tutorial guiado, passo a passo</Link>
          </div>
        </div>
        <p className="mt-6 text-xs text-[color:var(--muted-foreground)]">Ledivan · seu consultório e suas finanças, num só lugar</p>
      </section>
    </div>
  );
}
