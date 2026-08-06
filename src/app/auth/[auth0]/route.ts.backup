import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as jose from "jose";

/**
 * Auth0 Route Handler Simplificado
 * Gerencia login, logout e callback
 * Path: /auth/*
 */

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH0_SECRET || "default-secret-change-in-production"
);

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

    case "callback":
      // Processar callback (simplificado para desenvolvimento)
      // Em produção, validar token OAuth
      const email = searchParams.get("email");
      if (email) {
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });

        if (user) {
          await createSession(user.id);
          return NextResponse.redirect(
            new URL(searchParams.get("returnTo") || "/dashboard", request.url)
          );
        }
      }
      return NextResponse.redirect(new URL("/login?error=auth", request.url));

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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
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