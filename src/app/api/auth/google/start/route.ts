import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Início do login com Google REAL (OAuth 2.0). Diferente do fluxo antigo (que era whitelist sem
 * senha, removido), aqui o Google autentica de verdade: redirecionamos para o consentimento do
 * Google e voltamos no /callback com um code que trocamos por tokens server-to-server.
 *
 * `state` (aleatório, guardado em cookie httpOnly) protege contra CSRF no callback.
 * Só funciona depois que GOOGLE_CLIENT_ID/SECRET estiverem no ambiente (passo do console).
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google_nao_configurado", request.url));
  }

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/dashboard";
  const state = crypto.randomBytes(16).toString("hex");

  const jar = await cookies();
  jar.set("g_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  jar.set("g_oauth_return", returnTo, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(auth.toString());
}
