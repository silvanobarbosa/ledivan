import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="bg-background text-on-background font-sans min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .sticker-border {
            border: 4px solid white;
            box-shadow: 0px 4px 20px rgba(0, 109, 119, 0.15);
        }
        .gradient-bg {
            background: linear-gradient(135deg, #006d77 0%, #00e475 100%);
        }
      `}} />

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-md shadow-sm border-b border-border/50">
        <div className="flex justify-between items-center px-6 py-4 max-w-[1140px] mx-auto">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="material-symbols-outlined text-primary text-3xl group-hover:rotate-12 transition-transform">savings</span>
            <span className="font-display text-2xl text-primary font-bold tracking-tight">capicash</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            {["Metodologia", "Funcionalidades", "Segurança"].map((item) => (
              <Link key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-foreground/60 hover:text-primary transition-colors">
                {item}
              </Link>
            ))}
          </nav>

          <Link 
            href={session ? "/dashboard" : "/login"} 
            className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 hover:shadow-lg hover:shadow-primary/20 shadow-sm"
          >
            {session ? "Ir para o Dashboard" : "Começar agora"}
          </Link>
        </div>
      </header>

      <div className="pt-24 pb-12">
        {/* Hero Section */}
        <section className="px-5 mb-12 max-w-[1140px] mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-surface-container-low p-8 shadow-sm">
            <h1 className="text-3xl md:text-5xl font-bold text-primary mb-6 leading-tight max-w-2xl">
              Suas finanças estão um verdadeiro caos?
            </h1>
            <p className="text-on-surface-variant text-lg mb-8 max-w-xl">
              A falta de organização não é apenas um problema matemático, é um peso emocional que rouba sua paz.
            </p>
            <div className="rounded-2xl overflow-hidden mb-8 shadow-lg max-w-4xl mx-auto">
              <img 
                alt="Capivara desesperada com contas" 
                className="w-full h-auto object-cover" 
                src="https://lh3.googleusercontent.com/aida/ADBb0ujC3zu1mXZNPEf-YzA_J65eqSPKBWX5ge132447Ycj3jwYvA3uUZq9cQ6fFzp6-lRayTO0SP9S1-6yyHq5QF2zOxXXz7TVVqlZ8eYfJdPSND2Y80aWNzVVqoWp4ZIZXC_QmMAw2Rai8EWDGlHzLoht4PU2xR3TuvKPTj3VVTDf1YXNU-Oj03DXzAhwXT5nhahATPPAvVaao5Wr0-Ldaxk7z6WDFTIj2sNYk9bkelpGoU1nPycd0ZQF2WKs"
              />
            </div>
            <div className="bg-error-container/20 border-l-4 border-error p-6 rounded-r-xl">
              <h3 className="font-bold text-error mb-2">O Custo do Descontrole:</h3>
              <ul className="text-on-surface-variant text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-error rounded-full" />
                  Noites em claro pensando nos boletos
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-error rounded-full" />
                  Ansiedade ao abrir o app do banco
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-error rounded-full" />
                  Aquela sensação de que o dinheiro "some"
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* The Methodology (Capi-Zen) */}
        <section id="metodologia" className="px-5 mb-12 bg-primary/5 py-16">
          <div className="max-w-[1140px] mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-primary mb-2">Capi-Zen: Os 4 Pilares da sua Liberdade</h2>
              <p className="text-on-surface-variant text-lg">A metodologia testada para sair do vermelho e entrar no modo zen.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: "visibility",
                  title: "1. Clareza Automática",
                  desc: "Pare de preencher planilhas. Com Scan AI e Open Finance, cada centavo é categorizado sem esforço.",
                  color: "bg-primary-container text-on-primary-container"
                },
                {
                  icon: "mic",
                  title: "2. Comandos de Voz",
                  desc: "Envie áudios para o nosso Bot no Telegram. A IA transcreve e registra tudo enquanto você caminha.",
                  color: "bg-secondary-container text-on-secondary-container"
                },
                {
                  icon: "sports_esports",
                  title: "3. Metas Divertidas",
                  desc: "Economizar não precisa ser chato. Gamificamos sua jornada: ganhe emblemas conforme se aproxima dos seus sonhos.",
                  color: "bg-tertiary-container text-on-tertiary-container"
                },
                {
                  icon: "psychology",
                  title: "4. Insights Reais",
                  desc: "Nossa IA entende seu bolso e sugere onde você pode cortar gastos sem perder sua qualidade de vida.",
                  color: "bg-surface-container-highest text-primary"
                }
              ].map((pilar, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`${pilar.color} p-2 rounded-xl`}>
                      <span className="material-symbols-outlined">{pilar.icon}</span>
                    </div>
                    <h3 className="font-bold text-primary">{pilar.title}</h3>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{pilar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product Deep Dive */}
        <section id="funcionalidades" className="px-5 mb-12 max-w-[1140px] mx-auto">
          <h2 className="text-3xl font-bold text-primary text-center mb-12">O Poder do Capi na sua Mão</h2>
          <div className="mb-12 rounded-2xl overflow-hidden shadow-2xl border-8 border-white group">
            <img 
              alt="App CapiCash em ação" 
              className="w-full transform group-hover:scale-[1.02] transition-transform duration-700" 
              src="https://lh3.googleusercontent.com/aida/ADBb0ujatRvEBX5N60JmRtKV5Otx8_tVBRZWc9T5C6ZTXX56J0TbC7HM7puCOYMdgwtuX497PcqTbeuIRKm0aQNlufx3QRrCi7IdOTe0bUK8nMhCGCw6Sm7F2cX1BUSZH-9BJeRz-HNFe13lwGFYp1FwQHEynyLf2vaGlpxeP_EU0cx3ps4Tr-WRMdJdG81-HMN5pm_SUWMlzZrmITsEBaIcX2iOQD0udm0_liu16ucx8G9ikKr2y0SGIk-5HHM"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
              <h4 className="font-bold text-primary mb-2">Capi-Scan</h4>
              <p className="text-on-surface-variant text-sm">Aponte a câmera para qualquer nota fiscal ou boleto. O app lê os dados e registra na hora. Adeus, esquecimento!</p>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
              <h4 className="font-bold text-primary mb-2">Capi-Voice</h4>
              <p className="text-on-surface-variant text-sm">Falar é mais rápido que digitar. Mande um áudio no Telegram contando o gasto e a IA categoriza tudo em segundos.</p>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
              <h4 className="font-bold text-primary mb-2">Capi-Meter</h4>
              <p className="text-on-surface-variant text-sm">Acompanhe visualmente o progresso das suas reservas. Veja sua reserva de emergência crescer com barras intuitivas.</p>
            </div>
            <div className="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
              <h4 className="font-bold text-primary mb-2">Capi-Insights</h4>
              <p className="text-on-surface-variant text-sm">Receba dicas personalizadas: "Você gastou 15% a mais com delivery este mês. Que tal um Capi-Jantar em casa?"</p>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="px-5 mb-12 max-w-[1140px] mx-auto">
          <h2 className="text-3xl font-bold text-secondary text-center mb-12">Histórias de Sucesso da Comunidade Capivara</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Ricardo L., 29 anos", initials: "RL", text: "\"Antes do CapiCash, eu tinha medo de olhar minha conta. Hoje, eu até me divirto batendo minhas metas de economia!\"" },
              { name: "Mariana A., 34 anos", initials: "MA", text: "\"O Scan AI mudou minha vida. Registro tudo em segundos no caminho do trabalho. Nunca mais perdi um boleto.\"" },
              { name: "João S., 42 anos", initials: "JS", text: "\"Consegui finalmente juntar para minha viagem de férias seguindo as dicas do Capi-Insights. É como ter um mentor no bolso.\"" }
            ].map((depo, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl border-l-4 border-secondary-container shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-1 text-secondary mb-4">
                  {[...Array(5)].map((_, i) => <span key={i} className="material-symbols-outlined text-sm">star</span>)}
                </div>
                <p className="text-on-surface-variant italic mb-6 leading-relaxed">{depo.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center font-bold text-primary text-sm">{depo.initials}</div>
                  <p className="font-bold text-sm">{depo.name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Transformation Section */}
        <section className="px-5 mb-12 max-w-[1140px] mx-auto">
          <div className="gradient-bg p-12 rounded-3xl text-white text-center shadow-2xl">
            <h2 className="text-3xl font-bold mb-8">Sinta o alívio imediato</h2>
            <div className="mb-8 max-w-3xl mx-auto">
              <img 
                alt="Capivara relaxada vendo progresso" 
                className="w-full rounded-2xl border-4 border-white/20 shadow-lg" 
                src="https://lh3.googleusercontent.com/aida/ADBb0uieWJGv2roKm_KW89YY6umTKKSvx0QyjTPf_2W_EgMX5EW3AK5SBziExE_2BEONASU_oUX9TZ7tFhJTlCY-dZFOnrZ9Dzo9KlY9YFhYZIE9SsFoQni0KSkBLiDuVGAhbkMnJfhmM3C9Rx3CqXhOZxSMOTRvbFZaGlP-SE_hZDzHEuK2Gp-bA6RGvtJvhq0V1kwZ6WjZmB8ERMdnknfvpa3MKrDgE6tq9N2Fn6Zkfp6LM_yrNDqebUaipQ"
              />
            </div>
            <div className="h-4 w-full bg-white/20 rounded-full overflow-hidden max-w-xl mx-auto border border-white/10">
              <div className="h-full bg-white w-[92%] rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000"></div>
            </div>
            <p className="mt-4 font-bold text-lg">Seu Progresso para o Zen Financeiro: 92%</p>
          </div>
        </section>

        {/* Financial Freedom Visual */}
        <section className="px-5 mb-12 max-w-[1140px] mx-auto">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[21/9]">
            <img 
              alt="Liberdade financeira total" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida/ADBb0uibfTf5KDb8NcZqKinq7qfFIqvBKneXPE6Lgmcd1nLx4cgGf4J0PxMHSt0zBpzOKJKF9A6KPnPl5VqwlM4POFbMec1mCM8wAcgQr1v2UzfOvkDsAfIcgIaj4tP-NC1Ev5tdKKKnj5TS9TcvcR0bShGZmCtt3JZiEWev5WjdbUU9mbWWvoUrY1NI87cxtpFCuOdragmP2GKsrD4N40r6I_LcPgk-B9ZhdJjSDDa-Qh1ufS29nOZ2DZrvqVY"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-12">
              <div className="text-white max-w-2xl">
                <h2 className="text-3xl font-bold mb-4">Isso é Liberdade.</h2>
                <p className="text-lg opacity-90 leading-relaxed">Viver sem se preocupar com a próxima conta. Com CapiCash, o destino final é o seu bem-estar e a sua tranquilidade.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="segurança" className="px-5 mb-12 max-w-[800px] mx-auto">
          <h2 className="text-3xl font-bold text-primary text-center mb-12">Dúvidas Frequentes</h2>
          <div className="space-y-4">
            {[
              { q: "Meus dados estão seguros?", a: "Sim! Utilizamos criptografia de nível bancário (AES-256) e seguimos rigorosamente a LGPD. Seus dados são seus e de mais ninguém." },
              { q: "O app é pago?", a: "Temos uma versão gratuita completa para você começar. Também oferecemos o plano Premium com recursos avançados de IA para quem quer acelerar a jornada." },
              { q: "É fácil de usar?", a: "Foi desenhado para ser o app de finanças mais intuitivo do mundo. Se você sabe tirar uma foto, você sabe usar o CapiCash." }
            ].map((faq, i) => (
              <details key={i} className="group bg-white rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm transition-all hover:border-primary/30">
                <summary className="flex justify-between items-center p-6 cursor-pointer select-none">
                  <span className="font-bold text-primary">{faq.q}</span>
                  <span className="material-symbols-outlined transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div className="px-6 pb-6 text-on-surface-variant leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="px-5 max-w-[1140px] mx-auto">
          <div className="bg-surface-container-high rounded-3xl overflow-hidden shadow-xl border border-outline-variant/30 text-center p-12 md:p-20">
            <div className="flex justify-center mb-8">
              <div className="flex -space-x-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`w-12 h-12 rounded-full border-4 border-white bg-surface-variant flex items-center justify-center text-xs font-bold shadow-sm ${i === 3 ? 'z-10' : ''}`}>
                    {i === 3 ? '+50k' : String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-primary mb-6">Junte-se a mais de 50.000 Capivaras</h2>
            <p className="text-on-surface-variant text-lg mb-10 max-w-2xl mx-auto">
              Não deixe para amanhã a paz financeira que você pode ter hoje. Faça parte da comunidade que mais cresce no Brasil.
            </p>
            <Link 
              href="/login" 
              className="inline-block w-full md:w-auto gradient-bg text-white font-bold text-xl px-12 py-5 rounded-full shadow-lg transition-all active:scale-95 hover:brightness-110 mb-6"
            >
              Começar Minha Jornada Agora
            </Link>
            <p className="text-on-surface-variant text-sm opacity-70">Grátis para começar • Sem cartão de crédito • Cancela a qualquer momento</p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="w-full py-16 px-6 bg-surface-container-lowest border-t border-outline-variant/30 mt-12">
        <div className="max-w-[1140px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-3xl">savings</span>
              <span className="text-2xl font-bold text-primary font-display">capicash</span>
            </div>
            <p className="text-on-surface-variant text-sm">© 2026 capicash. Encontre seu zen financeiro com a calma de uma capivara.</p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-6">
            {["Segurança", "Privacidade", "Termos", "Ajuda"].map(link => (
              <a key={link} className="text-on-surface-variant text-sm hover:text-primary transition-colors font-medium" href="#">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
