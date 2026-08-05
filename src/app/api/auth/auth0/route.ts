import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import * as jose from "jose";
import crypto from "crypto";

/**
 * Auth0 OAuth Handler com segurança real
 * Implementa OAuth 2.0 com PKCE para login seguro
 */

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || "reverblabs.us.auth0.com";
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID || "2VXKwNQwG0AWiCKJGYoOgOW5EL8zJNjS";
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET!;
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH0_SECRET || crypto.randomBytes(32).toString("hex")
);

// Armazena states temporários para validação
const pendingStates = new Map<string, {
  returnTo: string;
  codeVerifier: string;
  expires: number;
}>();

// Limpa states expirados
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (data.expires < now) {
      pendingStates.delete(state);
    }
  }
}, 60000); // A cada minuto

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

async function createSession(userId: string) {
  const token = await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("auth-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  switch (action) {
    case "login": {
      // Inicia fluxo OAuth com PKCE
      const returnTo = searchParams.get("returnTo") || "/dashboard";
      const state = crypto.randomBytes(16).toString("hex");
      const { verifier, challenge } = generatePKCE();

      // Armazena state para validação
      pendingStates.set(state, {
        returnTo,
        codeVerifier: verifier,
        expires: Date.now() + 600000 // 10 minutos
      });

      // URL de autorização Auth0
      const params = new URLSearchParams({
        response_type: "code",
        client_id: AUTH0_CLIENT_ID,
        redirect_uri: `${request.nextUrl.origin}/api/auth/auth0?action=callback`,
        scope: "openid profile email",
        state: state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account", // Força seleção de conta Google
      });

      const authUrl = `https://${AUTH0_DOMAIN}/authorize?${params}`;
      return NextResponse.redirect(authUrl);
    }

    case "callback": {
      // Processa callback OAuth
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        console.error("Auth0 error:", error, searchParams.get("error_description"));
        return NextResponse.redirect(new URL("/login?error=auth", request.url));
      }

      if (!code || !state) {
        return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));
      }

      // Valida state
      const stateData = pendingStates.get(state);
      if (!stateData) {
        console.error("Invalid or expired state");
        return NextResponse.redirect(new URL("/login?error=invalid_state", request.url));
      }

      pendingStates.delete(state); // Use apenas uma vez

      try {
        // Troca código por token
        const tokenResponse = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: AUTH0_CLIENT_ID,
            client_secret: AUTH0_CLIENT_SECRET,
            code: code,
            code_verifier: stateData.codeVerifier,
            redirect_uri: `${request.nextUrl.origin}/api/auth/auth0?action=callback`,
          }),
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          console.error("Token exchange failed:", error);
          return NextResponse.redirect(new URL("/login?error=token_exchange", request.url));
        }

        const tokens = await tokenResponse.json();

        // Busca informações do usuário
        const userInfoResponse = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          console.error("Failed to fetch user info");
          return NextResponse.redirect(new URL("/login?error=userinfo", request.url));
        }

        const userInfo = await userInfoResponse.json();

        // Verifica/cria usuário no banco
        let user = await db.query.users.findFirst({
          where: eq(users.email, userInfo.email.toLowerCase())
        });

        if (!user) {
          // Cria novo usuário
          const [newUser] = await db.insert(users).values({
            email: userInfo.email.toLowerCase(),
            name: userInfo.name || userInfo.email.split("@")[0],
            emailVerified: userInfo.email_verified ? new Date() : null,
            image: userInfo.picture,
            role: "user",
            createdAt: new Date(),
          }).returning();
          user = newUser;
        } else {
          // Atualiza informações do usuário
          await db.update(users)
            .set({
              name: userInfo.name || user.name,
              image: userInfo.picture || user.image,
              emailVerified: userInfo.email_verified ? new Date() : user.emailVerified,
            })
            .where(eq(users.id, user.id));
        }

        // Cria sessão
        await createSession(user.id);

        // Redireciona para returnTo
        return NextResponse.redirect(new URL(stateData.returnTo, request.url));
      } catch (error) {
        console.error("OAuth callback error:", error);
        return NextResponse.redirect(new URL("/login?error=oauth", request.url));
      }
    }

    case "logout": {
      // Limpa sessão local
      const cookieStore = await cookies();
      cookieStore.delete("auth-session");

      // Logout no Auth0
      const params = new URLSearchParams({
        client_id: AUTH0_CLIENT_ID,
        returnTo: request.nextUrl.origin,
      });

      const logoutUrl = `https://${AUTH0_DOMAIN}/v2/logout?${params}`;
      return NextResponse.redirect(logoutUrl);
    }

    default:
      return new Response("Not found", { status: 404 });
  }
}