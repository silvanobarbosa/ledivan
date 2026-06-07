import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Wallet,
  Repeat2,
  ScanLine,
  MessageCircle,
  BarChart3,
  Target,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
  Quote,
  Heart,
  Leaf,
  Mail,
  Video,
} from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { Reveal } from "@/components/landing/Reveal";

export const metadata: Metadata = {
  title: "Ledivan — Seu consultório e suas finanças, num só lugar",
  description:
    "Para terapeutas: pacientes, agenda, financeiro e integrações com Google e WhatsApp — do atendimento ao caixa, sem planilhas.",
};

const P = (n: number) => `/landing/photo-${n}.jpg`;
const photos = {
  tablet: P(1),
  therapistMan: P(2),
  therapistWoman: P(3),
  windowMan: P(4),
  tissueMoment: P(5),
  planner: P(6),
  tabletWoman: P(7),
  session: P(9),
  teaWoman: P(10),
  couch: P(9),
  windowRoom: P(10),
  handsTalk: P(5),
  notesPen: P(6),
  cozyChair: P(3),
  twoSilhouette: P(9),
};

export default function Landing() {
  return (
    <div className="bg-ornaments min-h-screen text-ink overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Trust />
        <Manifesto />
        <Problem />
        <Features />
        <Integrations />
        <HowItWorks />
        <Highlight />
        <Testimonial />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(250,246,241,0.72)] border-b border-[rgba(43,24,48,0.06)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Logo />
        <nav className="hidden md:flex items-center gap-8 text-sm text-[color:var(--muted-foreground)]">
          <a href="#features" className="hover:text-ink transition">Funcionalidades</a>
          <a href="#integrations" className="hover:text-ink transition">Integrações</a>
          <a href="#how" className="hover:text-ink transition">Como funciona</a>
          <a href="#pricing" className="hover:text-ink transition">Preço</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-ink/80 hover:text-ink hover:bg-white/60 transition">
            Entrar
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-eggplant)] px-4 py-2.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">
            Começar agora
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24 md:pb-28">
      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div className="reveal-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.08)] bg-white/70 px-3 py-1 text-xs font-medium text-[color:var(--brand-eggplant)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" />
            Feito para terapeutas e clínicas
          </span>
          <h1 className="font-display mt-6 text-5xl md:text-6xl lg:text-[5.5rem] font-medium leading-[1.02] tracking-tight text-[color:var(--brand-eggplant)]">
            O seu divã,
            <span className="italic text-[color:var(--accent-violet)]"> organizado.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-[color:var(--muted-foreground)] leading-relaxed">
            Pacientes, agenda, financeiro e suas integrações favoritas — do
            primeiro contato ao fechamento do mês, sem planilhas espalhadas.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login" className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">
              Experimentar grátis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.12)] bg-white/60 px-6 py-3.5 text-sm font-medium text-ink hover:bg-white transition">
              Ver como funciona
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-[color:var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" /> 14 dias grátis</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" /> Sem cartão para testar</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" /> Dados isolados e seguros</span>
          </div>
        </div>
        <HeroVisual />
      </div>
      <ScribbleDivider />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative reveal-up" style={{ animationDelay: "120ms" }}>
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[3rem]"
        style={{
          background:
            "radial-gradient(60% 60% at 70% 20%, rgba(139,92,246,0.32), transparent 70%), radial-gradient(50% 50% at 10% 90%, rgba(196,181,253,0.45), transparent 70%)",
          filter: "blur(24px)",
        }}
      />
      <div className="relative h-[440px] md:h-[520px]">
        <div className="absolute top-0 right-0 w-[78%] h-[60%] rounded-[2rem] overflow-hidden shadow-[var(--shadow-glass-lg)] border border-white/40 float-soft">
          <img src={photos.windowRoom} alt="Sala de atendimento com luz natural" className="h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(43,24,48,0.25)] via-transparent to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 w-[78%] glass-card-lg p-5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[color:var(--muted-foreground)]">Boa tarde, Gisele</p>
              <p className="font-display text-lg font-medium text-[color:var(--brand-eggplant)]">Próximas sessões</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-[color:var(--brand-eggplant)] text-cream grid place-items-center text-[11px] font-medium">GL</div>
          </div>
          <ul className="mt-4 space-y-2">
            {[
              { t: "14:00", n: "Mariana S.", c: "#8b5cf6" },
              { t: "15:00", n: "Rafael C.", c: "#047857" },
              { t: "16:30", n: "Bianca M.", c: "#b45309" },
            ].map((s) => (
              <li key={s.t} className="flex items-center justify-between rounded-xl border border-[rgba(43,24,48,0.05)] bg-[color:var(--cream)] px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.c, boxShadow: `0 0 0 4px ${s.c}22` }} />
                  <span className="text-xs font-medium tabular-nums text-ink">{s.t}</span>
                  <span className="text-xs text-[color:var(--muted-foreground)]">{s.n}</span>
                </div>
                <span className="text-[10px] text-[color:var(--muted-foreground)]">50min</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden sm:block absolute top-[55%] right-[-1rem] glass-card p-4 w-44 z-20 float-soft" style={{ animationDelay: "1.5s" }}>
          <p className="text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">Receita do mês</p>
          <p className="font-display text-2xl font-medium text-[color:var(--brand-eggplant)] tabular-nums">R$ 9.840</p>
          <div className="mt-2 h-1.5 rounded-full bg-[rgba(43,24,48,0.06)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: "72%", background: "linear-gradient(90deg, #c4b5fd, #8b5cf6)" }} />
          </div>
        </div>
        <div className="hidden sm:flex absolute bottom-[60%] left-[-1rem] glass-card px-3 py-2 z-20 items-center gap-2 float-soft" style={{ animationDelay: "2.5s" }}>
          <img src="https://cdn.simpleicons.org/whatsapp/25D366" alt="" className="h-4 w-4" />
          <span className="text-[11px] text-ink">&quot;50 material&quot; → lançado ✓</span>
        </div>
      </div>
    </div>
  );
}

function ScribbleDivider() {
  return (
    <svg aria-hidden viewBox="0 0 1200 60" className="mt-16 w-full text-[color:var(--accent-violet)]/30" fill="none" preserveAspectRatio="none">
      <path d="M0 40 Q 150 5 300 30 T 600 30 T 900 30 T 1200 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Trust() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-6">
      <Reveal className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
        <span className="inline-flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" /> Pensado por terapeutas</span>
        <span className="opacity-30">•</span>
        <span>LGPD ready</span>
        <span className="opacity-30">•</span>
        <span className="inline-flex items-center gap-2"><Leaf className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" /> Interface tranquila</span>
      </Reveal>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <Reveal>
          <div className="relative">
            <div aria-hidden className="absolute -inset-8 -z-10 rounded-[3rem]" style={{ background: "radial-gradient(55% 55% at 30% 30%, rgba(139,92,246,0.28), transparent 70%), radial-gradient(45% 45% at 80% 80%, rgba(196,181,253,0.4), transparent 70%)", filter: "blur(22px)" }} />
            <div className="grid grid-cols-5 grid-rows-6 gap-3 h-[380px] sm:h-[520px]">
              <div className="col-span-3 row-span-4 rounded-[2rem] overflow-hidden shadow-[var(--shadow-glass-lg)] border border-white/40">
                <img src={photos.teaWoman} alt="Terapeuta em momento de pausa" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="col-span-2 row-span-3 rounded-[1.75rem] overflow-hidden shadow-[var(--shadow-glass)] border border-white/40 float-soft">
                <img src={photos.windowMan} alt="Terapeuta refletindo" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="col-span-2 row-span-3 rounded-[1.75rem] overflow-hidden shadow-[var(--shadow-glass)] border border-white/40">
                <img src={photos.tabletWoman} alt="Profissional usando o aplicativo" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="col-span-3 row-span-2 rounded-[1.75rem] overflow-hidden shadow-[var(--shadow-glass)] border border-white/40 float-soft" style={{ animationDelay: "1.2s" }}>
                <img src={photos.tablet} alt="Agenda em tablet sobre a mesa" className="h-full w-full object-cover" loading="lazy" />
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Nosso manifesto</p>
          <h2 className="font-display mt-4 text-4xl md:text-[3.25rem] font-medium leading-[1.05] text-[color:var(--brand-eggplant)]">
            Para quem cuida da <span className="italic text-[color:var(--accent-violet)]">saúde mental</span> das pessoas,
          </h2>
          <p className="mt-5 text-lg md:text-xl text-[color:var(--muted-foreground)] leading-relaxed">
            uma solução única para que também mantenha <span className="text-[color:var(--brand-eggplant)] font-medium">a sua</span> no dia a dia — facilitando sua jornada profissional.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-[rgba(43,24,48,0.12)]" />
            <Heart className="h-4 w-4 text-[color:var(--accent-violet)]" />
            <div className="h-px flex-1 bg-[rgba(43,24,48,0.12)]" />
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { n: "−50%", l: "do tempo consumido por gestão" },
              { n: "100%", l: "do seu mês, à vista" },
              { n: "0", l: "planilhas para abrir" },
              { n: "Tempo real", l: "sua gestão sempre à mão — em breve módulo contábil" },
            ].map((s) => (
              <div key={s.n} className="glass-card p-4 text-center">
                <p className="font-display text-2xl font-medium text-[color:var(--brand-eggplant)] tabular-nums">{s.n}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-[color:var(--muted-foreground)] leading-snug">{s.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Problem() {
  const pains = [
    { t: "Planilhas e cadernos", d: "Informações de pacientes espalhadas, difíceis de achar quando você precisa." },
    { t: "Faltas sem controle", d: "Sessões remarcadas viram dor de cabeça e perda de receita silenciosa." },
    { t: "Cobrança confusa", d: "Quem pagou? Quem está atrasado? A inadimplência cresce sem você ver." },
    { t: "Financeiro às cegas", d: "Sem clareza do que entra e sai no consultório mês a mês." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">O problema</p>
          <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium leading-tight text-[color:var(--brand-eggplant)]">
            Cuidar de pessoas é seu trabalho. <br />
            <span className="italic text-[color:var(--muted-foreground)]">A burocracia, não.</span>
          </h2>
          <div className="mt-8 relative rounded-[2rem] overflow-hidden h-72 shadow-[var(--shadow-glass-lg)]">
            <img src={photos.handsTalk} alt="Conversa em sessão" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(43,24,48,0.55)] via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 font-display text-xl text-cream italic leading-snug">
              &quot;Você cuida da escuta. <br />A gente cuida do resto.&quot;
            </p>
          </div>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4">
          {pains.map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div className="glass-card p-6 h-full hover:-translate-y-1 transition-transform duration-300">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(185,28,28,0.08)] text-[#b91c1c] text-xs font-medium">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-display mt-4 text-xl font-medium text-[color:var(--brand-eggplant)]">{p.t}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const feats = [
    { icon: Users, t: "Pacientes", d: "Cadastro completo, status, valor, contrato e histórico de reajustes." },
    { icon: CalendarDays, t: "Agenda visual", d: "Grade semanal estilo Google Calendar, status em 1 clique." },
    { icon: Mail, t: "Mensagens com pacientes", d: "Fale direto com seus pacientes por WhatsApp, Telegram e e-mail, sem sair do app." },
    { icon: Video, t: "Vídeo no Google Meet", d: "Links de atendimento online criados automaticamente na agenda." },
    { icon: Wallet, t: "Financeiro", d: "Receitas, despesas, contas e categorias num lugar só." },
    { icon: Repeat2, t: "Pagamento vira receita", d: "Vínculo automático e opcional — você decide." },
    { icon: ScanLine, t: "Scan de recibo com IA", d: "Foto do comprovante e a IA lança a despesa." },
    { icon: MessageCircle, t: "Lançamentos por mensagem", d: "Registre gastos pelo WhatsApp ou Telegram, por texto ou voz." },
    { icon: BarChart3, t: "Relatórios mensais", d: "Receita, despesa e saldo com filtro de período." },
    { icon: Target, t: "Metas e poupança", d: "Objetivos com barra de progresso e prazo." },
    { icon: ShieldCheck, t: "Segurança", d: "Cada conta com espaço isolado e protegido." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Funcionalidades</p>
            <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-tight">
              Tudo que o consultório precisa, conectado.
            </h2>
          </div>
          <p className="text-[color:var(--muted-foreground)] max-w-sm">
            Do primeiro contato com o paciente ao fechamento do mês — sem trocar de ferramenta.
          </p>
        </div>
      </Reveal>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {feats.map((f, i) => (
          <Reveal key={f.t} delay={i * 60}>
            <div className="glass-card p-6 group h-full hover:-translate-y-1 hover:shadow-[var(--shadow-glass-lg)] transition-all duration-300">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[color:var(--brand-eggplant)] group-hover:bg-[color:var(--accent-violet)] group-hover:text-cream transition" style={{ background: "rgba(139,92,246,0.12)" }}>
                <f.icon className="h-5 w-5" />
              </div>
              <p className="font-display mt-5 text-xl font-medium text-[color:var(--brand-eggplant)]">{f.t}</p>
              <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Integrations() {
  const items: { name: string; slug: string; color: string; d: string; extra?: { slug: string; color: string } }[] = [
    { name: "Gmail", slug: "gmail", color: "EA4335", d: "Confirmações e recibos automáticos por e-mail." },
    { name: "Google Agenda", slug: "googlecalendar", color: "4285F4", d: "Sincronize sessões nos dois sentidos." },
    { name: "Google Meet / Jitsi", slug: "googlemeet", color: "00897B", extra: { slug: "jitsimeet", color: "1D76BA" }, d: "Atendimento online: links gerados na agenda (Google Meet ou Jitsi)." },
    { name: "WhatsApp", slug: "whatsapp", color: "25D366", d: "Registre gastos e lembre pacientes por mensagem." },
    { name: "Telegram", slug: "telegram", color: "26A5E4", d: "Bot pessoal para lançamentos por voz ou texto." },
  ];
  return (
    <section id="integrations" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Integrações</p>
          <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-tight">
            Conecta com as ferramentas que você já usa.
          </h2>
          <p className="mt-4 text-[color:var(--muted-foreground)]">
            Sem migrar nada. O Ledivan conversa com seu Google e seus apps de mensagem.
          </p>
        </div>
      </Reveal>
      <div className="mt-14 relative">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {items.map((it, i) => (
            <Reveal key={it.name} delay={i * 90}>
              <div className="glass-card p-6 h-full text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="mx-auto h-14 w-auto px-4 rounded-2xl bg-white inline-flex items-center justify-center gap-2 shadow-[var(--shadow-glass)] group-hover:scale-110 transition-transform" style={{ border: `1px solid #${it.color}22` }}>
                  <img src={`https://cdn.simpleicons.org/${it.slug}/${it.color}`} alt={`Integração com ${it.name}`} className="h-7 w-7" loading="lazy" />
                  {it.extra && (
                    <img src={`https://cdn.simpleicons.org/${it.extra.slug}/${it.extra.color}`} alt="Jitsi" className="h-7 w-7" loading="lazy" />
                  )}
                </div>
                <p className="font-display mt-4 text-lg font-medium text-[color:var(--brand-eggplant)]">{it.name}</p>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)] leading-relaxed">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Cadastre pacientes e sessões", d: "Importe ou comece do zero. Tudo organizado em minutos.", photo: photos.notesPen },
    { n: "02", t: "Registre pagamentos", d: "Cada pagamento pode virar receita automaticamente.", photo: photos.cozyChair },
    { n: "03", t: "Acompanhe agenda e relatórios", d: "Veja seu mês fechar com clareza, sem planilhas.", photo: photos.twoSilhouette },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Como funciona</p>
          <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-tight">
            Três passos. Zero planilhas.
          </h2>
        </div>
      </Reveal>
      <div className="mt-12 grid md:grid-cols-3 gap-5">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <div className="glass-card overflow-hidden h-full group">
              <div className="relative h-44 overflow-hidden">
                <img src={s.photo} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent" />
                <span className="absolute top-4 left-4 font-display text-3xl font-medium text-cream tabular-nums drop-shadow-md">{s.n}</span>
              </div>
              <div className="p-6">
                <p className="font-display text-xl font-medium text-[color:var(--brand-eggplant)]">{s.t}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{s.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Highlight() {
  const msgs = [
    { msg: "50 material de escritório", side: "right" as const },
    { msg: "✓ Despesa de R$ 50,00 lançada em Material.", side: "left" as const },
    { msg: "📷 foto-recibo.jpg", side: "right" as const },
    { msg: "✓ Recibo: R$ 128,90 — Farmácia. Categorizado em Saúde.", side: "left" as const },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] p-10 md:p-14 text-cream" style={{ background: "linear-gradient(135deg, #2b1830 0%, #3a2240 60%, #5b2d7a 100%)", boxShadow: "var(--shadow-eggplant)" }}>
          <div aria-hidden className="absolute -right-20 -top-20 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%)" }} />
          <div aria-hidden className="absolute -left-10 -bottom-10 h-60 w-60 rounded-full" style={{ background: "radial-gradient(circle, rgba(196,181,253,0.35), transparent 70%)" }} />
          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-soft)]">Diferencial</p>
              <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium leading-tight">
                Registre um gasto mandando uma mensagem.
              </h2>
              <p className="mt-4 text-cream/80 leading-relaxed max-w-md">
                &quot;<span className="text-cream">50 material</span>&quot; no WhatsApp e pronto. Ou tire foto do recibo — a IA extrai valor, descrição e categoria pra você.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <img src="https://cdn.simpleicons.org/whatsapp/25D366" alt="WhatsApp" className="h-7 w-7" />
                <img src="https://cdn.simpleicons.org/telegram/26A5E4" alt="Telegram" className="h-7 w-7" />
                <span className="text-xs text-cream/60 uppercase tracking-wider">funciona em ambos</span>
              </div>
            </div>
            <div className="space-y-3">
              {msgs.map((m, i) => (
                <Reveal key={i} delay={i * 180}>
                  <div className={`flex ${m.side === "right" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.side === "right" ? "bg-[color:var(--accent-violet)] text-cream rounded-tr-sm" : "bg-white/10 text-cream backdrop-blur rounded-tl-sm"}`}>
                      {m.msg}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Testimonial() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-6 items-stretch">
          <div className="relative rounded-[2rem] overflow-hidden min-h-[260px]">
            <img src={photos.couch} alt="Sala de terapia" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(43,24,48,0.5)] to-transparent" />
          </div>
          <div className="glass-card p-10 flex flex-col justify-center">
            <Quote className="h-8 w-8 text-[color:var(--accent-violet)]" />
            <p className="font-display mt-5 text-2xl md:text-3xl text-[color:var(--brand-eggplant)] leading-snug italic">
              &quot;Pela primeira vez sei exatamente quanto entra e sai do consultório, sem perder minha tarde com planilhas.&quot;
            </p>
            <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">Psicóloga clínica · São Paulo</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Pricing() {
  const benefits = [
    "Pacientes, sessões e agenda ilimitados",
    "Financeiro completo com relatórios",
    "IA para recibos e insights",
    "Bot no WhatsApp e Telegram",
    "Gmail, Google Agenda e Google Meet",
  ];
  return (
    <section id="pricing" className="mx-auto max-w-4xl px-6 py-24">
      <Reveal>
        <div className="text-center max-w-xl mx-auto">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Preço</p>
          <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-tight">
            Um plano. Tudo incluso.
          </h2>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className="mt-12 glass-card-lg p-10 md:p-12 max-w-md mx-auto text-center relative overflow-hidden">
          <div aria-hidden className="absolute -top-16 -right-16 h-48 w-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)" }} />
          <p className="text-sm text-[color:var(--muted-foreground)]">Plano único</p>
          <p className="font-display mt-3 text-6xl font-medium text-[color:var(--brand-eggplant)] tabular-nums">
            R$ 49<span className="text-lg text-[color:var(--muted-foreground)]"> /mês</span>
          </p>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">14 dias grátis. Sem cartão para começar.</p>
          <ul className="mt-8 space-y-3 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-ink">
                <Check className="h-4 w-4 mt-0.5 text-[color:var(--accent-violet)] flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
          <Link href="/login" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">
            Experimentar grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function FAQ() {
  const items = [
    { q: "Meus dados ficam seguros?", a: "Sim. Cada terapeuta tem um espaço totalmente isolado, com criptografia e backups automáticos." },
    { q: "Funciona bem no celular?", a: "Sim, é totalmente responsivo. A agenda, pacientes e financeiro foram pensados para uso no celular entre sessões." },
    { q: "Integra com o Google Agenda e Google Meet?", a: "Sim. Você sincroniza sessões com o Google Agenda e os links de atendimento online no Google Meet são gerados automaticamente." },
    { q: "Como funciona o bot do WhatsApp e Telegram?", a: "Você manda uma mensagem ou foto de recibo e o lançamento entra direto no financeiro, já categorizado." },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--accent-violet)]">Perguntas frequentes</p>
          <h2 className="font-display mt-3 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)]">Tudo claro?</h2>
        </div>
      </Reveal>
      <div className="space-y-3">
        {items.map((i, idx) => (
          <Reveal key={i.q} delay={idx * 70}>
            <details className="glass-card group p-6 [&[open]>summary>span:last-child]:rotate-45">
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                <span className="font-display text-lg font-medium text-[color:var(--brand-eggplant)]">{i.q}</span>
                <span className="text-2xl text-[color:var(--accent-violet)] transition-transform">+</span>
              </summary>
              <p className="mt-3 text-sm text-[color:var(--muted-foreground)] leading-relaxed">{i.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] p-12 md:p-20 text-center" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.8), rgba(237,233,254,0.8))", border: "1px solid rgba(43,24,48,0.06)", boxShadow: "var(--shadow-glass-lg)" }}>
          <div aria-hidden className="absolute -top-20 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)" }} />
          <h2 className="relative font-display text-5xl md:text-6xl font-medium text-[color:var(--brand-eggplant)] leading-[1.05]">
            Organize seu consultório <br />
            <span className="italic text-[color:var(--accent-violet)]">hoje.</span>
          </h2>
          <p className="relative mt-5 text-lg text-[color:var(--muted-foreground)]">14 dias grátis. Sem compromisso.</p>
          <Link href="/login" className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-7 py-4 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition">
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[rgba(43,24,48,0.08)] bg-[rgba(250,246,241,0.5)] backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--muted-foreground)]">
          <a href="#features" className="hover:text-ink transition">Funcionalidades</a>
          <a href="#integrations" className="hover:text-ink transition">Integrações</a>
          <a href="#pricing" className="hover:text-ink transition">Preço</a>
          <Link href="/login" className="hover:text-ink transition">Entrar</Link>
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)]">© 2026 Ledivan</p>
      </div>
    </footer>
  );
}
