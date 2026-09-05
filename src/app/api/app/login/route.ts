import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { assinarSessao } from "@/lib/session-secret";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Login do app nativo por e-mail + senha. Devolve um TOKEN BEARER (a mesma sessão assinada que o
 * navegador usa por cookie) + os dados do usuário. O app guarda o token no secure-store e o manda
 * no header Authorization nas próximas chamadas.
 *
 * Deliberadamente NÃO usa o fluxo "Google" da web (que é whitelist por e-mail, sem senha — fraco
 * para dado de paciente). Aqui exige senha de verdade (bcrypt).
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  // Mesma barreira do login web: fail-closed por e-mail e por IP (dado de paciente atrás).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (
    !(await rateLimit(email, "app-login-email", 10, 900, { failClosed: true })) ||
    !(await rateLimit(ip, "app-login-ip", 30, 900, { failClosed: true }))
  ) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Mensagem única para não revelar se o e-mail existe.
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  // Conta demo (Dr. Sócrates): o bearer também carrega o claim `demo` → o proxy recusa qualquer
  // escrita feita pelo app com esse token. Read-only no app igual ao navegador.
  const token = await assinarSessao(String(user.id), "7d", { demo: user.isDemo });
  return NextResponse.json({
    token,
    user: { id: String(user.id), email: user.email, name: user.name, role: user.role, isDemo: user.isDemo },
  });
}
