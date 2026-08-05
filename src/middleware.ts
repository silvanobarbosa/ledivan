import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ledivan-demo-secret-2026'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verificar se é uma sessão demo
  const isDemoCookie = request.cookies.get('is-demo');
  const demoSession = request.cookies.get('ledivan-demo-session');

  // Se é uma sessão demo, verificar validade
  if (isDemoCookie?.value === 'true' && demoSession) {
    try {
      // Verificar token JWT
      await jose.jwtVerify(demoSession.value, JWT_SECRET);

      // Se tentando acessar áreas sensíveis, bloquear
      const blockedPaths = [
        '/dashboard/settings',
        '/api/auth/google',
        '/api/patients/create',
        '/api/patients/update',
        '/api/patients/delete',
        '/api/transactions/create',
        '/api/transactions/update',
        '/api/transactions/delete'
      ];

      for (const blockedPath of blockedPaths) {
        if (pathname.startsWith(blockedPath)) {
          return NextResponse.json(
            { error: 'Esta ação não está disponível no modo demonstração' },
            { status: 403 }
          );
        }
      }

      // Adicionar header para identificar sessão demo
      const response = NextResponse.next();
      response.headers.set('X-Demo-Session', 'true');
      return response;

    } catch (error) {
      // Token inválido ou expirado, limpar cookies
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('is-demo');
      response.cookies.delete('ledivan-demo-session');
      return response;
    }
  }

  // Para sessões normais, verificar autenticação em rotas protegidas
  const protectedPaths = ['/dashboard', '/api/'];
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath && !pathname.startsWith('/api/auth')) {
    const authSession = request.cookies.get('ledivan-auth');
    const authToken = request.cookies.get('auth-token');

    // Se não há sessão e não é demo, redirecionar para login
    if (!authSession && !authToken && !demoSession) {
      // Exceto para a rota /demo que cria a sessão demo
      if (pathname === '/demo') {
        return NextResponse.next();
      }

      return NextResponse.redirect(new URL('/login?returnTo=' + pathname, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)$).*)',
  ],
};