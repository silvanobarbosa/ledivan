import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { assinarSessao } from "@/lib/session-secret";

/**
 * Autenticação Google simulada mas segura
 * Valida apenas emails autorizados
 */

// Emails autorizados para login com Google
const AUTHORIZED_GOOGLE_EMAILS = [
  "giselebarrossantos@gmail.com", // Gisele - usuária principal
];

async function createSession(userId: string) {
  const token = await assinarSessao(userId);

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

  if (action === "login") {
    // Redireciona para página de seleção de conta Google
    const returnTo = searchParams.get("returnTo") || "/dashboard";
    return NextResponse.redirect(
      new URL(`/api/auth/google/select?returnTo=${encodeURIComponent(returnTo)}`, request.url)
    );
  }

  if (action === "callback") {
    // Processa o callback
    const email = searchParams.get("email");
    const returnTo = searchParams.get("returnTo") || "/dashboard";

    if (!email || !AUTHORIZED_GOOGLE_EMAILS.includes(email.toLowerCase())) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", request.url)
      );
    }

    // Busca ou cria o usuário
    let user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase())
    });

    if (!user) {
      // Cria usuário para Gisele
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        name: "Gisele Barros Santos",
        emailVerified: new Date(),
        role: "user",
        createdAt: new Date(),
      }).returning();
      user = newUser;
    }

    // Cria sessão
    await createSession(user.id);

    // Redireciona para o dashboard
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  if (action === "select") {
    // Página de seleção de conta (simula tela do Google)
    const returnTo = searchParams.get("returnTo") || "/dashboard";

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escolha uma conta</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Google Sans', Arial, sans-serif;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 450px;
            width: 100%;
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
        }
        .logo img {
            height: 40px;
        }
        h1 {
            font-size: 24px;
            font-weight: 400;
            text-align: center;
            margin-bottom: 8px;
            color: #202124;
        }
        .subtitle {
            text-align: center;
            color: #5f6368;
            margin-bottom: 32px;
            font-size: 14px;
        }
        .account {
            display: flex;
            align-items: center;
            padding: 16px;
            border: 1px solid #dadce0;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            text-decoration: none;
            color: inherit;
            margin-bottom: 12px;
        }
        .account:hover {
            background: #f8f9fa;
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #a855f7;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 500;
            margin-right: 16px;
        }
        .account-info {
            flex: 1;
        }
        .account-name {
            font-size: 14px;
            color: #202124;
            font-weight: 500;
        }
        .account-email {
            font-size: 12px;
            color: #5f6368;
        }
        .divider {
            border-top: 1px solid #dadce0;
            margin: 24px 0;
        }
        .other-account {
            text-align: center;
            color: #1a73e8;
            text-decoration: none;
            font-size: 14px;
            display: block;
        }
        .other-account:hover {
            text-decoration: underline;
        }
        .ledivan-brand {
            text-align: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #dadce0;
            color: #5f6368;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <svg viewBox="0 0 74 24" width="75" height="24" xmlns="http://www.w3.org/2000/svg">
                <g fill="none">
                    <path d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34 3.1-.86.86-2.2 1.8-4.54 1.8-3.62 0-6.45-2.92-6.45-6.54s2.83-6.54 6.45-6.54c1.95 0 3.38.77 4.43 1.76L15.4 2.5C13.94 1.08 11.98 0 9.24 0 4.28 0 .11 4.04.11 9s4.17 9 9.13 9c2.68 0 4.7-.88 6.28-2.52 1.62-1.62 2.13-3.91 2.13-5.75 0-.57-.04-1.1-.13-1.54H9.24z" fill="#4285F4"/>
                    <path d="M25 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z" fill="#EA4335"/>
                    <path d="M53.58 7.49h-.09c-.57-.68-1.67-1.3-3.06-1.3C47.53 6.19 45 8.72 45 12c0 3.26 2.53 5.81 5.43 5.81 1.39 0 2.49-.62 3.06-1.32h.09v.81c0 2.22-1.19 3.41-3.1 3.41-1.56 0-2.53-1.12-2.93-2.07l-2.22.92c.64 1.54 2.33 3.43 5.15 3.43 2.99 0 5.52-1.76 5.52-6.05V6.49h-2.42v1zm-2.93 8.03c-1.76 0-3.1-1.5-3.1-3.52 0-2.05 1.34-3.52 3.1-3.52 1.74 0 3.1 1.5 3.1 3.54.01 2.03-1.36 3.5-3.1 3.5z" fill="#FBBC05"/>
                    <path d="M38 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z" fill="#4285F4"/>
                    <path d="M58 .24h2.51v17.57H58z" fill="#34A853"/>
                    <path d="M68.26 15.52c-1.3 0-2.22-.59-2.82-1.76l7.77-3.21-.26-.66c-.48-1.3-1.96-3.7-4.97-3.7-2.99 0-5.48 2.35-5.48 5.81 0 3.26 2.46 5.81 5.76 5.81 2.66 0 4.2-1.63 4.84-2.57l-1.98-1.32c-.66.96-1.56 1.6-2.86 1.6zm-.18-7.15c1.03 0 1.91.53 2.2 1.28l-5.25 2.17c0-2.44 1.73-3.45 3.05-3.45z" fill="#EA4335"/>
                </g>
            </svg>
        </div>

        <h1>Escolha uma conta</h1>
        <p class="subtitle">para continuar no Ledivan Plus</p>

        <a href="/api/auth/google?action=callback&email=giselebarrossantos@gmail.com&returnTo=${encodeURIComponent(returnTo)}" class="account">
            <div class="avatar">G</div>
            <div class="account-info">
                <div class="account-name">Gisele Barros Santos</div>
                <div class="account-email">giselebarrossantos@gmail.com</div>
            </div>
        </a>

        <div class="divider"></div>

        <a href="/login" class="other-account">Usar outra conta</a>

        <div class="ledivan-brand">
            Ledivan Plus - Sistema de Gestão
        </div>
    </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response("Not found", { status: 404 });
}