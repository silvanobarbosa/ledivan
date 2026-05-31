import { signIn } from "@/auth";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[48px] shadow-2xl overflow-hidden relative z-10 border border-border">
        {/* Left Side: Brand & Visual */}
        <div className="p-12 lg:p-20 bg-primary text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,50 C20,20 40,80 60,50 C80,20 100,80 120,50" stroke="white" fill="transparent" strokeWidth="0.5" />
            </svg>
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="w-20 h-20 bg-white rounded-[24px] flex items-center justify-center text-primary shadow-xl">
              <span className="font-display font-bold text-4xl">L<span className="text-accent">+</span></span>
            </div>
            <h1 className="text-5xl font-display font-bold tracking-tight leading-tight">
              Seu consultório e suas finanças, num só lugar.
            </h1>
            <p className="text-xl text-white/70 font-medium max-w-md">
              O Ledivan+ reúne a gestão de pacientes, sessões e agenda com um módulo financeiro completo.
            </p>
          </div>

          <div className="relative z-10 pt-12 space-y-8">
            <div className="flex items-center gap-4">
              <p className="text-sm font-bold text-white/80">Pacientes · Agenda · Financeiro · Metas</p>
            </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-12 lg:p-20 flex flex-col justify-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl font-display font-bold text-foreground">Bem-vindo de volta!</h2>
            <p className="text-foreground/40 font-medium text-lg">
              Acesse sua conta para gerenciar o consultório.
            </p>
          </div>

          <div className="space-y-6">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-4 py-5 bg-white border-2 border-border rounded-[24px] text-lg font-bold text-foreground hover:bg-surface hover:border-primary/20 transition-all group"
              >
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" alt="Google" />
                <span>Entrar com Google</span>
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" />
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-foreground/30 font-bold tracking-widest">ou use seu e-mail</span></div>
            </div>

            <form
              action={async (formData) => {
                "use server";
                try {
                  const email = formData.get("email") as string;
                  await signIn("resend", { email, redirectTo: "/dashboard" });
                } catch (error) {
                  // NextAuth redireciona lançando um erro, então precisamos repassá-lo
                  if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
                    throw error;
                  }
                  console.error("Erro no Login Action:", error);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  required
                  className="w-full px-6 py-4 bg-surface border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Receber Código de Acesso
              </button>
            </form>
          </div>

          <div className="pt-12 space-y-6 border-t border-border">
            <div className="flex items-center gap-3 text-primary">
              <Sparkles className="w-5 h-5" />
              <p className="text-sm font-bold">Scan de recibos com IA & Insights</p>
            </div>
            <p className="text-xs text-foreground/30 font-medium">
              Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
