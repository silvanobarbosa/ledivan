"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { startDemo } from "@/app/demo/actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /**
   * Doc 55: entrar só com o e-mail, sem senha.
   *
   * O modo por CÓDIGO é o padrão porque foi o pedido — senha é a coisa que ela esquece, e
   * "esqueci a senha" é a tela que ninguém quer abrir às oito da noite com paciente esperando.
   * A senha continua existindo atrás de um link: tirar um caminho que funciona não era o pedido.
   */
  const [modo, setModo] = useState<"codigo" | "senha">("codigo");
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");
  // Link de download do app Android. Vem de /api/app/version → sempre a versão atual (nunca preso
  // a um APK velho hardcoded). O card só aparece quando há um apkUrl publicado.
  const [app, setApp] = useState<{ version: string; apkUrl: string } | null>(null);
  const [googleOn, setGoogleOn] = useState(false);
  useEffect(() => {
    fetch("/api/app/version")
      .then((r) => r.json())
      .then((d) => {
        if (d?.apkUrl) setApp({ version: d.version, apkUrl: d.apkUrl });
        if (d?.googleEnabled) setGoogleOn(true);
      })
      .catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(data.redirectTo || returnTo);
      } else {
        setError(data.error || "Erro ao fazer login");
      }
    } catch (_err) {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Pede o código. A resposta do servidor é sempre a mesma, exista a conta ou não — então a tela
   * também não pode variar: ela avança para o passo do código em qualquer caso. Dizer "e-mail
   * não encontrado" aqui entregaria quem usa o sistema.
   */
  const pedirCodigo = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setAviso("");
    setLoading(true);
    try {
      await fetch("/api/auth/codigo/pedir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setEtapa("codigo");
      setAviso("Se existe uma conta com esse e-mail, o código foi enviado — confira o e-mail e, se o seu Telegram estiver vinculado, o Telegram também.");
    } catch {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const entrarComCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/codigo/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo }),
      });
      const data = await res.json();
      if (res.ok && data.ok) router.push(data.redirectTo || returnTo);
      else setError(data.error || "Código inválido");
    } catch {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setLoading(true);
    try {
      // A senha da demo NÃO fica mais no cliente. A server action prepara o sandbox e abre a
      // sessão no servidor; ela mesma redireciona para /dashboard ao final.
      await startDemo();
    } catch (_err) {
      setError("Erro ao acessar conta demo");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/ledivan-color.png"
              alt="Ledivan Plus"
              width={180}
              height={60}
              className="object-contain"
              priority
            />
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            Bem-vindo ao Ledivan Plus
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Sistema de Gestão de Consultório
          </p>

          {/* Formulário */}
          <form onSubmit={modo === "senha" ? handleSubmit : (etapa === "email" ? pedirCodigo : entrarComCodigo)} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {aviso && !error && (
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                {aviso}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="seu@email.com"
                required
                // No passo do código o e-mail fica travado: mudá-lo ali invalidaria o código que
                // acabou de chegar, e o erro só apareceria depois de digitar os seis dígitos.
                disabled={loading || (modo === "codigo" && etapa === "codigo")}
                autoComplete="email"
              />
            </div>

            {modo === "senha" && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            )}

            {modo === "codigo" && etapa === "codigo" && (
              <div>
                <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">
                  Código de 6 dígitos
                </label>
                {/* `inputMode="numeric"` abre o teclado de números no celular; `autoComplete`
                    deixa o iPhone e o Android oferecerem o código do SMS/e-mail direto. */}
                <input
                  id="codigo"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent tracking-[0.4em] text-center text-lg"
                  placeholder="000000"
                  required
                  autoFocus
                  disabled={loading}
                />
                <div className="flex items-center justify-between mt-2 text-xs">
                  <button type="button" onClick={() => { setEtapa("email"); setCodigo(""); setAviso(""); setError(""); }}
                    className="text-gray-500 hover:underline">
                    Usar outro e-mail
                  </button>
                  <button type="button" onClick={() => pedirCodigo()} disabled={loading}
                    className="text-purple-600 font-semibold hover:underline disabled:opacity-50">
                    Enviar outro código
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? (modo === "codigo" && etapa === "email" ? "Enviando..." : "Entrando...")
                : (modo === "codigo" && etapa === "email" ? "Enviar código" : "Entrar")}
            </button>

            {/* O outro caminho. A senha continua lá para quem a usa. */}
            <button
              type="button"
              onClick={() => { setModo(modo === "codigo" ? "senha" : "codigo"); setEtapa("email"); setCodigo(""); setPassword(""); setError(""); setAviso(""); }}
              className="w-full text-sm text-gray-500 hover:text-purple-600 hover:underline"
            >
              {modo === "codigo" ? "Prefiro entrar com a minha senha" : "Entrar sem senha, com código no e-mail ou Telegram"}
            </button>
          </form>

          {/* Divisor */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          {/* Login com Google REAL (OAuth) — só aparece quando configurado */}
          {googleOn && (
            <a
              href={`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg border border-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Entrar com Google</span>
            </a>
          )}

          {/* Link para conta demo */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium py-2 transition-colors disabled:opacity-50"
            >
              🎯 Experimentar com conta demonstração
            </button>
          </div>
          {/* Link para criar conta */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{" "}
              <a href="/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                Criar conta grátis
              </a>
            </p>
          </div>


          {/* Baixar o app Android — link sempre da versão atual (/api/app/version) */}
          {app && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <a
                href={app.apkUrl}
                className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-purple-200 bg-purple-50 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <span>📱</span>
                <span>Baixar app Android v{app.version}</span>
              </a>
              <p className="text-xs text-center text-gray-400 mt-2">
                Instale o app para registrar sessões mesmo sem internet.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              © 2024 Ledivan Plus. Todos os direitos reservados.
            </p>
            <p className="text-xs text-center text-gray-400 mt-1">
              Sistema profissional de gestão de consultórios e clínicas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}