import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { immuneCheck } from "@/lib/immune-client";
import * as jose from "jose";

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
    pathname.startsWith("/api/sessions/confirm") // paciente confirma/remarca via link assinado (HMAC), sem login
  ) {
    return NextResponse.next();
  }

  // Verificar se é sessão demo
  const isDemoCookie = req.cookies.get('is-demo');
  const demoSession = req.cookies.get('ledivan-demo-session');

  // Se é uma sessão demo, validar e adicionar headers
  if (isDemoCookie?.value === 'true' && demoSession) {
    try {
      const JWT_SECRET = new TextEncoder().encode(
        process.env.JWT_SECRET || 'ledivan-demo-secret-2026'
      );

      // Verificar token JWT
      await jose.jwtVerify(demoSession.value, JWT_SECRET);

      // Bloquear ações sensíveis em modo demo
      const blockedPaths = [
        '/api/patients/create',
        '/api/patients/update',
        '/api/patients/delete',
        '/api/transactions/create',
        '/api/transactions/update',
        '/api/transactions/delete'
      ];

      for (const blockedPath of blockedPaths) {
        if (pathname.startsWith(blockedPath)) {
          return NextResponse.json(
            { error: 'Esta ação não está disponível no modo demonstração' },
            { status: 403 }
          );
        }
      }

      // Adicionar header para identificar sessão demo
      const response = NextResponse.next();
      response.headers.set('X-Demo-Session', 'true');
      return response;
    } catch (error) {
      // Token inválido ou expirado, limpar cookies
      const response = NextResponse.redirect(new URL('/', req.url));
      response.cookies.delete('is-demo');
      response.cookies.delete('ledivan-demo-session');
      return response;
    }
  }

  const isPublicRoute =
    pathname === "/" ||
    pathname === "/demo" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacidade") ||
    pathname.startsWith("/termos") ||
    pathname.startsWith("/agendar") ||
    pathname.startsWith("/sala-convidado/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/humor/") ||
    pathname.startsWith("/escala/") ||
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
