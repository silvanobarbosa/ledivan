import Link from "next/link";
import {
  Users,
  CalendarDays,
  Wallet,
  ArrowRight,
  ScanLine,
  Link2,
  ShieldCheck,
} from "lucide-react";

const features = [
  { icon: Users, title: "Pacientes", desc: "Cadastro completo, histórico de status, preços e contratos." },
  { icon: CalendarDays, title: "Agenda", desc: "Sessões da semana, status e remarcações num só lugar." },
  { icon: Wallet, title: "Financeiro", desc: "Transações, contas, metas e relatórios integrados." },
  { icon: Link2, title: "Vínculo opcional", desc: "Pagamento de sessão vira receita no financeiro quando você quiser." },
  { icon: ScanLine, title: "Scan com IA", desc: "Fotografe um recibo e registre a despesa automaticamente." },
  { icon: ShieldCheck, title: "Dados isolados", desc: "Cada terapeuta tem seu espaço, privado e seguro." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-16 py-6 max-w-7xl mx-auto">
        <Link href="/" className="block">
          <img src="/ledivan-color.png" alt="L'E-Divan" className="h-12 w-auto object-contain" />
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
        >
          Entrar <ArrowRight className="w-4 h-4" />
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 lg:px-16 pt-16 lg:pt-28 pb-20 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur border border-border rounded-full text-xs font-bold text-primary uppercase tracking-widest">
          Consultório + Finanças
        </div>
        <h1 className="text-5xl lg:text-7xl font-display font-bold text-primary leading-[1.05] tracking-tight">
          Seu consultório e suas finanças, num só lugar.
        </h1>
        <p className="text-xl text-foreground/50 font-medium max-w-2xl mx-auto leading-relaxed">
          O Ledivan+ reúne a gestão de pacientes, sessões e agenda com um módulo
          financeiro completo. Tudo conectado, do atendimento ao caixa.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Começar agora <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 lg:px-16 pb-28">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="glass-card rounded-[28px] p-7 space-y-4 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-primary">{f.title}</h3>
              <p className="text-foreground/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-16 pb-28">
        <div className="bg-primary rounded-[40px] p-12 lg:p-20 text-center text-white shadow-2xl shadow-primary/20 space-y-6">
          <h2 className="text-4xl lg:text-5xl font-display font-bold">Pronto para organizar tudo?</h2>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Entre com sua conta e comece a gerenciar pacientes, sessões e finanças hoje.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-white text-primary px-8 py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] transition-all"
          >
            Entrar no Ledivan+ <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center">
        <p className="text-foreground/40 text-sm">© 2026 Ledivan+ — Gestão de consultório e finanças.</p>
      </footer>
    </div>
  );
}
