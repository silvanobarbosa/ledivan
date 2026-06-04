import { signIn } from "@/auth";
import Link from "next/link";
import { Mail, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = {
  title: "Entrar — Ledivan",
  description: "Acesse sua conta Ledivan para gerenciar seu consultório e financeiro.",
};

export default function LoginPage() {
  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-[color:var(--muted-foreground)] hover:text-ink transition">
          ← Voltar
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-md">
          <div
            aria-hidden
            className="absolute -inset-10 -z-10 rounded-[3rem]"
            style={{
              background:
                "radial-gradient(60% 60% at 30% 20%, rgba(139,92,246,0.3), transparent 70%), radial-gradient(50% 50% at 80% 80%, rgba(196,181,253,0.35), transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          <div className="glass-card-lg p-8 md:p-10 reveal-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(43,24,48,0.08)] bg-white/70 px-3 py-1 text-xs font-medium text-[color:var(--brand-eggplant)]">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-violet)]" />
              Bem-vindo de volta
            </span>
            <h1 className="font-display mt-5 text-4xl md:text-5xl font-medium text-[color:var(--brand-eggplant)] leading-[1.05]">
              Entrar no <span className="italic text-[color:var(--accent-violet)]">Ledivan</span>
            </h1>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              Acesse com seu Google ou receba um link mágico no e-mail.
            </p>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <SubmitButton
                pendingLabel="Conectando ao Google…"
                className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full border border-[rgba(43,24,48,0.12)] bg-white px-5 py-3.5 text-sm font-medium text-ink hover:bg-white/80 hover:shadow-[var(--shadow-glass)] transition"
              >
                <GoogleIcon />
                Continuar com Google
              </SubmitButton>
            </form>

            <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              <span className="h-px flex-1 bg-[rgba(43,24,48,0.1)]" />
              ou com e-mail
              <span className="h-px flex-1 bg-[rgba(43,24,48,0.1)]" />
            </div>

            <form
              action={async (formData) => {
                "use server";
                try {
                  const email = formData.get("email") as string;
                  await signIn("resend", { email, redirectTo: "/dashboard" });
                } catch (error) {
                  if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
                  console.error("Erro no login por e-mail:", error);
                }
              }}
              className="space-y-3"
            >
              <div className="relative">
                <label htmlFor="login-email" className="sr-only">E-mail</label>
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--muted-foreground)]" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  aria-label="Seu endereço de e-mail"
                  placeholder="seu@email.com"
                  className="w-full rounded-full border border-[rgba(43,24,48,0.12)] bg-white/70 pl-11 pr-4 py-3.5 text-sm text-ink placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:border-[color:var(--accent-violet)] focus:ring-4 focus:ring-[rgba(139,92,246,0.15)] transition"
                />
              </div>
              <SubmitButton
                pendingLabel="Enviando link…"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--brand-eggplant)] px-6 py-3.5 text-sm font-medium text-cream shadow-[var(--shadow-eggplant)] hover:bg-[color:var(--brand-eggplant-soft)] transition"
              >
                Enviar link de acesso
                <ArrowRight className="h-4 w-4" />
              </SubmitButton>
            </form>

            <p className="mt-7 text-center text-xs text-[color:var(--muted-foreground)]">
              Ao continuar, você concorda com nossos{" "}
              <a href="/termos" className="text-[color:var(--brand-eggplant)] underline-offset-4 hover:underline">Termos de Serviço</a>{" "}
              e a{" "}
              <a href="/privacidade" className="text-[color:var(--brand-eggplant)] underline-offset-4 hover:underline">Política de Privacidade</a>.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-[color:var(--muted-foreground)]">
            Ainda não tem conta?{" "}
            <Link href="/" className="text-[color:var(--brand-eggplant)] font-medium hover:underline">
              Conheça o Ledivan
            </Link>
          </p>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs text-[color:var(--muted-foreground)]">
        © 2026 Ledivan · Cuidando de quem cuida.
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
