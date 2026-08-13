"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Link de download do app Android. Vem de /api/app/version → sempre a versão atual (nunca preso
  // a um APK velho hardcoded). O card só aparece quando há um apkUrl publicado.
  const [app, setApp] = useState<{ version: string; apkUrl: string } | null>(null);
  useEffect(() => {
    fetch("/api/app/version")
      .then((r) => r.json())
      .then((d) => { if (d?.apkUrl) setApp({ version: d.version, apkUrl: d.apkUrl }); })
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
    } catch (err) {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "demo@ledivan.com.br",
          password: "ledivan-demo-2026"
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(data.redirectTo || "/dashboard");
      } else {
        setError("Erro ao acessar conta demo");
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor");
    } finally {
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
              src="/ledivancolor.png"
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
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
                disabled={loading}
                autoComplete="email"
              />
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
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