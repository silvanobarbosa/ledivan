import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth(async function proxy(req) {
  const { nextUrl, auth: session } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!session;

  // Permite APIs públicas e Auth.js
  if (pathname.includes("/api/auth") || pathname.startsWith("/api/telegram") || pathname.startsWith("/api/whatsapp") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Define rotas públicas
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/agendar") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/humor/") ||
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|json|js)$).*)"],
};
