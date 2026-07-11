import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { immuneCheck } from "@/lib/immune-client";

export default auth(async function proxy(req) {
  // Sistema imunológico da frota (1º portão) — barra IP fichado/ataque. Next 16 usa proxy.ts
  // (não middleware.ts), então o imune roda AQUI. Wrap defensivo: nunca derruba o request.
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "0.0.0.0";
    const immune = await immuneCheck(
      { ip, path: req.nextUrl.pathname + req.nextUrl.search, ua: req.headers.get("user-agent") || "" },
      Date.now(),
    );
    if (immune.block) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    // qualquer falha no imune não pode derrubar o app → segue o fluxo normal
  }

  const { nextUrl, auth: session } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!session;

  // Permite APIs públicas e Auth.js
  if (pathname.includes("/api/auth") || pathname.startsWith("/api/telegram") || pathname.startsWith("/api/whatsapp") || pathname.startsWith("/api/cron") || pathname.startsWith("/api/health") || pathname.startsWith("/api/conformity")) {
    return NextResponse.next();
  }

  // Define rotas públicas
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

  if (isPublicRoute) {
    // Se já estiver logado e tentar ir para /login, manda pro dashboard
    if (isLoggedIn && pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Protege o resto
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Ignora estáticos do Next, favicon e arquivos de /public (imagens, fontes, manifest, sw).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|json|js|html)$).*)"],
};
