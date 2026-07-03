import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { setPreferences, getPreferences } from "@/lib/preferences";

// Callback da autorização incremental do Google Agenda: troca o code por tokens
// e grava/atualiza o refresh_token + escopo do Calendar na conta Google do terapeuta.
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || "https://ledivan.com.br";
  const settings = new URL("/dashboard/settings", base);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", base));
  const userId = session.user.id;

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error || !code) { settings.searchParams.set("google", "erro"); return NextResponse.redirect(settings); }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${base}/api/google/callback`,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!res.ok) { settings.searchParams.set("google", "erro"); return NextResponse.redirect(settings); }
    const t = await res.json();
    const expiresAt = Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600);

    // sub do usuário Google (providerAccountId)
    let sub = "";
    try {
      const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (ui.ok) sub = (await ui.json()).sub || "";
    } catch {}

    const existing = await db.query.accounts.findFirst({ where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")) });
    if (existing) {
      await db.update(accounts).set({
        access_token: t.access_token,
        ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
        expires_at: expiresAt,
        scope: t.scope,
        token_type: t.token_type,
        ...(t.id_token ? { id_token: t.id_token } : {}),
      }).where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));
    } else if (sub) {
      await db.insert(accounts).values({
        userId, type: "oidc", provider: "google", providerAccountId: sub,
        access_token: t.access_token, refresh_token: t.refresh_token ?? null,
        expires_at: expiresAt, scope: t.scope, token_type: t.token_type, id_token: t.id_token ?? null,
      });
    }

    // marca Google Agenda como conectado nas preferências (mantém a direção se já escolhida)
    const prefs = await getPreferences(userId);
    await setPreferences(userId, { integrations: { ...prefs.integrations, googleCalendar: true } });

    settings.searchParams.set("google", "ok");
    return NextResponse.redirect(settings);
  } catch {
    settings.searchParams.set("google", "erro");
    return NextResponse.redirect(settings);
  }
}
