import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Limpar TODOS os cookies relacionados à autenticação
    const cookiesToDelete = [
      'auth-session',
      'auth-token',
      'user-data',
      'session',
      'token',
      'refresh-token',
      'ledivan-auth',
      'ledivan-session'
    ];

    // Deletar cada cookie individualmente
    for (const cookieName of cookiesToDelete) {
      cookieStore.delete({
        name: cookieName,
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.ledivan.com.br' : undefined
      });
    }

    // Criar resposta de redirecionamento
    const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'https://ledivan.com.br'));

    // Adicionar headers para limpar cookies no cliente também
    response.headers.set('Clear-Site-Data', '"cookies", "storage"');

    // Adicionar headers de no-cache
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    // Em caso de erro, ainda tenta redirecionar
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'https://ledivan.com.br'));
  }
}

export async function POST() {
  // Mesma lógica para POST
  return GET();
}