import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { assinarSessao } from "@/lib/session-secret";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Auth0 Route Handler Simplificado
 * Gerencia login, logout e callback
 * Path: /auth/*
 */

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ auth0: string }> }
) {
  const { auth0: action } = await params;
  const searchParams = request.nextUrl.searchParams;

  switch (action) {
    case "login":
      // Redirecionar para página de login
      const returnTo = searchParams.get("returnTo") || "/dashboard";
      return NextResponse.redirect(
        new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, request.url)
      );

    case "logout":
      // Limpar sessão
      const cookieStore = await cookies();
      cookieStore.delete("auth-session");
      return NextResponse.redirect(new URL("/", request.url));

    // ATENÇÃO: NÃO reintroduzir um "callback" que emita sessão a partir de um e-mail na query.
    // Existiu aqui um `case "callback"` que fazia exatamente isso — `?email=<x>` → cookie de
    // sessão daquela conta, sem senha, sem code/state/PKCE. Era bypass TOTAL de autenticação
    // (acesso a prontuário/dado de saúde = LGPD). Removido. O login OAuth de verdade mora em
    // /api/auth/auth0 e /api/auth/google (com state assinado + PKCE); o login por senha, no POST
    // abaixo. Qualquer ação não tratada cai no 404.
    default:
      return new Response("Not found", { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ auth0: string }> }
) {
  const { auth0: action } = await params;

  if (action === "login") {
    // Login com email e senha
    const body = await request.json();
    const { email, password, name, signup } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const emailLower = String(email).toLowerCase();
    // Rate-limit fail-closed contra força bruta / credential stuffing. Por e-mail (alvo) e por IP.
    // Este endpoint guarda os prontuários — antes ia direto de req.json() para bcrypt, sem barreira.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
    if (
      !(await rateLimit(emailLower, "login-email", 10, 900, { failClosed: true })) ||
      !(await rateLimit(ip, "login-ip", 30, 900, { failClosed: true }))
    ) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
        { status: 429 }
      );
    }

    // Modo de criação de nova conta
    if (signup) {
      if (!name) {
        return NextResponse.json(
          { error: "Nome é obrigatório para criar uma conta" },
          { status: 400 }
        );
      }

      // Força mínima de senha validada NO SERVIDOR (o mínimo de 8 do signup/page.tsx é só no
      // cliente e é contornável mandando o POST direto).
      if (String(password).length < 8) {
        return NextResponse.json(
          { error: "A senha precisa ter ao menos 8 caracteres." },
          { status: 400 }
        );
      }

      // Verificar se usuário já existe
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, emailLower),
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "Já existe uma conta com este email" },
          { status: 409 }
        );
      }

      // Criar novo usuário
      const passwordHash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        email: emailLower,
        name: name,
        passwordHash: passwordHash,
        emailVerified: new Date(),
        role: "user",
        createdAt: new Date(),
      }).returning();

      await createSession(newUser.id);
      return NextResponse.json({ success: true, redirectTo: "/dashboard" });
    }

    // Modo de login normal
    const user = await db.query.users.findFirst({
      where: eq(users.email, emailLower),
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    await createSession(user.id);
    return NextResponse.json({ success: true, redirectTo: "/dashboard" });
  }

  return new Response("Not found", { status: 404 });
}
