import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { immuneCheck } from "@/lib/immune-client";
import { lerSessaoInfo } from "@/lib/session-secret";
import { verifyPatient } from "@/lib/patient-token";

/**
 * Proxy (middleware do Next 16) — migrado next-auth → Auth0 (02/08/2026).
 *  1. Auth0 monta /auth/* (login/callback/logout) + renova a sessão.
 *  2. Sistema imunológico (fail-open, no-op sem IMMUNE_HUB_URL).
 *  3. Gate deny-by-default: rota não-pública sem sessão Auth0 → /auth/login.
 */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth routes são tratadas pelo route handler, não pelo proxy
  if (pathname.startsWith("/auth")) return NextResponse.next();

  // MODO DEMONSTRAÇÃO = SOMENTE LEITURA. A conta demo (Dr. Sócrates) é pública e compartilhada;
  // ninguém pode alterar dado. Server actions e mutações de API são sempre POST/PUT/PATCH/DELETE,
  // então basta recusar qualquer método de escrita quando a sessão carrega o claim `demo`.
  // Navegação (GET/HEAD) segue liberada — é o ponto do demo. Um único choke point cobre tudo.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    // Sessão demo vem por cookie (navegador) OU por Bearer (app nativo). Cobre os dois.
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const raw = req.cookies.get("auth-session")?.value || bearer;
    const somenteLeitura = "Modo demonstração: somente leitura. Nenhum dado pode ser alterado nesta conta.";
    // Terapeuta demo (Dr. Sócrates): token de SESSÃO (jose JWT).
    if (raw && (await lerSessaoInfo(raw))?.demo) {
      return NextResponse.json({ error: somenteLeitura }, { status: 403 });
    }
    // Paciente demo (Srta. Dionísia): token do PACIENTE (HMAC próprio, formato diferente).
    if (bearer && verifyPatient(bearer)?.demo) {
      return NextResponse.json({ error: somenteLeitura }, { status: 403 });
    }
  }

  try {
    const ip =
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "0.0.0.0";
    const immune = await immuneCheck(
      { ip, path: pathname + req.nextUrl.search, ua: req.headers.get("user-agent") || "" },
      Date.now(),
    );
    if (immune.block) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    /* fail-open */
  }

  // APIs públicas / sem sessão de cookie.
  // /api/app/* é o app nativo: autentica por token BEARER (não cookie), então o gate de cookie
  // aqui não se aplica — cada rota /api/app cuida da própria auth (login e version são públicas;
  // resumo e as demais exigem o bearer via userFromBearer).
  if (
    pathname.startsWith("/api/app") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/conformity") ||
    pathname.startsWith("/api/sessions/confirm") || // paciente confirma/remarca via link assinado (HMAC), sem login
    pathname.startsWith("/api/patient") || // app do paciente: autentica por Bearer (token do paciente), cada rota cuida
    pathname.startsWith("/api/files") // download de arquivo: a própria rota exige sessão do terapeuta OU bearer do paciente
  ) {
    return NextResponse.next();
  }

  // (Removido) Bloco de "sessão demo" por cookie `ledivan-demo-session`: era assinado com
  // `JWT_SECRET || 'ledivan-demo-secret-2026'` — um segredo público (está no repo). Como o
  // fallback vale quando `JWT_SECRET` não está no ambiente (é o caso), um atacante assinava o
  // próprio cookie e o proxy devolvia `next()` ANTES do gate de rota/sessão, furando o
  // perímetro para qualquer caminho. A rota que emitia esse cookie (/api/demo) foi removida —
  // a demo agora entra pela sessão normal (`auth-session`), ver src/app/demo/actions.ts (#95).
  // O bloqueio de "ações sensíveis" apontava para rotas que nem existem no app.

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/demo" ||
    pathname === "/paciente-demo" ||   // portal web read-only da paciente demo (Srta. Dionísia)
    pathname === "/como-funciona" ||   // 2ª landing: infográfico end-to-end
    pathname.startsWith("/tutorial") || // tutorial guiado (usa os dois perfis demo)
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacidade") ||
    pathname.startsWith("/termos") ||
    pathname.startsWith("/agendar") ||
    pathname.startsWith("/sala-convidado/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/humor/") ||
    pathname.startsWith("/escala/") ||
    pathname.startsWith("/api/patient/demo") || // login demo do paciente (sem código)
    pathname.startsWith("/api/scan") ||
    pathname.startsWith("/api/insights");

  const session = await auth0.getSession().catch(() => null);

  if (isPublicRoute) {
    if (session && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|json|js|html)$).*)"],
};
