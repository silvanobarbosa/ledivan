import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { immuneCheck } from "@/lib/immune-client";

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

  // APIs públicas / sem sessão
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/telegram") ||
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/conformity")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute =
    pathname === "/" ||
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
