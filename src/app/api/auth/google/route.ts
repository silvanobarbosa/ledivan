import { NextRequest, NextResponse } from "next/server";

/**
 * Login "Google" DESATIVADO.
 *
 * Este endpoint NUNCA foi OAuth real do Google: era uma tela estilizada que logava qualquer
 * e-mail de uma whitelist SEM senha nem prova de posse. Ou seja, quem soubesse um e-mail
 * autorizado batia em `?action=callback&email=...` e ganhava sessão — inaceitável para dados de
 * paciente (LGPD).
 *
 * O login agora é só e-mail + senha (bcrypt) em /auth/login, que é o mesmo que o app nativo usa.
 * Qualquer chamada aqui redireciona para o login normal.
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}

export function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
