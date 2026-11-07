import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, loginCodes } from "@/db/schema";
import { rateLimit } from "@/lib/rateLimit";
import { conferirCodigo, digitosDoCodigo, RECADO } from "@/lib/codigoDeAcesso";
import { assinarSessao } from "@/lib/session-secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ENTRA COM O CÓDIGO (doc 55).
 *
 * Abre a mesma sessão que o login por senha e o Google abrem — cookie `auth-session`, mesmas
 * opções. Nada aqui inventa um caminho paralelo de autenticação: é a mesma porta, com outra
 * chave.
 *
 * Cada erro CONTA uma tentativa, inclusive quando a conta não existe. Sem isso, 6 dígitos viram
 * uma senha de 1 milhão de combinações para quem tem paciência e um script.
 */
export async function POST(req: Request) {
  let corpo: { email?: string; codigo?: string };
  try { corpo = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const email = String(corpo.email ?? "").trim().toLowerCase();
  const digitado = digitosDoCodigo(String(corpo.codigo ?? ""));
  if (!email || digitado.length !== 6) {
    return NextResponse.json({ ok: false, error: "Informe o e-mail e o código de 6 dígitos." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (!(await rateLimit(ip, "codigo-entrar-ip", 40, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  if (!(await rateLimit(`codigo-entrar:${email}`, "codigo-entrar", 10, 600, { failClosed: true }))) {
    return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos e peça um novo código." }, { status: 429 });
  }

  const segredo = process.env.AUTH0_SECRET;
  if (!segredo) return NextResponse.json({ ok: false, error: "Acesso por código indisponível." }, { status: 503 });

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Conta inexistente responde o MESMO que código errado — é a outra ponta da anti-enumeração.
  if (!user) return NextResponse.json({ ok: false, error: RECADO.incorreto }, { status: 401 });

  const [linha] = await db.select().from(loginCodes)
    .where(and(eq(loginCodes.userId, user.id), isNull(loginCodes.usadoEm)))
    .orderBy(desc(loginCodes.createdAt)).limit(1);

  const veredito = conferirCodigo(linha ?? null, digitado, segredo);

  if (!veredito.ok) {
    // A tentativa é contada ANTES de responder: é o contador que faz o código morrer.
    if (linha) {
      await db.update(loginCodes)
        .set({ tentativas: linha.tentativas + 1 })
        .where(eq(loginCodes.id, linha.id)).catch(() => {});
    }
    return NextResponse.json({ ok: false, error: RECADO[veredito.motivo] }, { status: 401 });
  }

  // Uso único: queima o código ANTES de abrir a sessão. Se a gravação falhar, ninguém entra com
  // um código que ficaria vivo — o contrário (sessão aberta, código vivo) é que seria o furo.
  await db.update(loginCodes).set({ usadoEm: new Date() }).where(eq(loginCodes.id, linha.id));

  const token = await assinarSessao(String(user.id), "7d", { via: "codigo" });
  const jar = await cookies();
  jar.set("auth-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  // A demo é read-only e vive noutro cookie; entrar de verdade tem de apagá-lo.
  jar.delete("is-demo");

  return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
}
