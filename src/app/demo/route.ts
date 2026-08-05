import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as jose from "jose";

// Configuração do usuário demo
const DEMO_USER = {
  id: 'demo-user-id',
  email: 'demo@ledivan.com.br',
  name: 'Usuário Demonstração',
  role: 'demo',
  isDemo: true,
  expiresAt: Date.now() + 30 * 60 * 1000 // Sessão demo expira em 30 minutos
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ledivan-demo-secret-2026'
);

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();

    // Primeiro, limpar qualquer sessão existente
    const cookiesToDelete = [
      'auth-session',
      'auth-token',
      'user-data',
      'session',
      'token',
      'ledivan-auth',
      'ledivan-session'
    ];

    for (const cookieName of cookiesToDelete) {
      cookieStore.delete({
        name: cookieName,
        path: '/'
      });
    }

    // Criar token JWT para usuário demo
    const token = await new jose.SignJWT({
      userId: DEMO_USER.id,
      email: DEMO_USER.email,
      name: DEMO_USER.name,
      role: DEMO_USER.role,
      isDemo: DEMO_USER.isDemo,
      exp: Math.floor(DEMO_USER.expiresAt / 1000)
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(JWT_SECRET);

    // Criar resposta de redirecionamento
    const response = NextResponse.redirect(
      new URL('/dashboard?demo=true', process.env.NEXT_PUBLIC_BASE_URL || 'https://ledivan.com.br')
    );

    // Definir cookie de sessão demo
    response.cookies.set({
      name: 'ledivan-demo-session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60 // 30 minutos
    });

    // Adicionar flag para identificar sessão demo
    response.cookies.set({
      name: 'is-demo',
      value: 'true',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 60 // 30 minutos
    });

    return response;
  } catch (error) {
    console.error('Erro ao criar sessão demo:', error);
    return NextResponse.redirect(
      new URL('/?error=demo-failed', process.env.NEXT_PUBLIC_BASE_URL || 'https://ledivan.com.br')
    );
  }
}