import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { assinarSessao } from "@/lib/session-secret";

export const dynamic = "force-dynamic";

/**
 * Callback do login Google real. Valida o `state`, troca o `code` por tokens no Google
 * (server-to-server), pega o e-mail VERIFICADO, acha ou cria o usuário e emite a sessão
 * (`auth-session`, a mesma do login por senha). Deny-by-default: qualquer falha → volta pro login.
 *
 * Cria a conta se o e-mail é novo — mesmo modelo do cadastro aberto do app (tenant vazio, role
 * user). Se você quiser restringir a e-mails já cadastrados, é só não criar aqui.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const stateCookie = jar.get("g_oauth_state")?.value;
  const returnTo = jar.get("g_oauth_return")?.value || "/dashboard";
  jar.delete("g_oauth_state");
  jar.delete("g_oauth_return");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(request, "google_nao_configurado");
  if (!code || !state || !stateCookie || state !== stateCookie) return fail(request, "google_state");

  // troca o code por tokens
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  }).then((r) => r.json()).catch(() => null);
  if (!tok?.access_token) return fail(request, "google_token");

  // e-mail verificado do usuário
  const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  }).then((r) => r.json()).catch(() => null);
  const email = String(info?.email || "").toLowerCase();
  if (!email || info?.email_verified === false) return fail(request, "google_email");

  // acha ou cria o usuário
  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    const [novo] = await db.insert(users).values({
      id: "usr_" + crypto.randomBytes(10).toString("hex"),
      email,
      name: info?.name || null,
      emailVerified: new Date(),
      role: "user",
      createdAt: new Date(),
    }).returning();
    user = novo;
  }

  const token = await assinarSessao(String(user.id));
  jar.set("auth-session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return NextResponse.redirect(new URL(returnTo, request.url));
}

function fail(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}
