import { NextRequest, NextResponse } from "next/server";
import { immuneCheck } from "@/lib/immune-client";

/**
 * Middleware = 1º portão de segurança (defesa em profundidade).
 * Sistema imunológico da frota: barra IP fichado por qualquer app + detecta
 * ataque (injection/traversal/xss/scanner). No-op gracioso sem IMMUNE_HUB_URL.
 * Roda ANTES de qualquer auth/rate-limit. Wrap defensivo: nunca quebra o request.
 */
export async function middleware(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      "0.0.0.0";
    const path = req.nextUrl.pathname + req.nextUrl.search;
    const ua = req.headers.get("user-agent") || "";

    const immune = await immuneCheck({ ip, path, ua }, Date.now());
    if (immune.block) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } catch {
    // qualquer falha no imune não pode derrubar o app → segue o fluxo normal
  }

  return NextResponse.next();
}

export const config = {
  // roda em tudo menos assets estáticos
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
