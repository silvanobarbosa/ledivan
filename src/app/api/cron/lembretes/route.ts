import { NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { tokensDoUsuario, enviarPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Lembrete de consultas do dia. Roda por cron (Authorization: Bearer CRON_SECRET). Para cada
 * profissional com sessões agendadas hoje, manda um push com a contagem. Simples de propósito —
 * o objetivo é a psicóloga abrir o app e ver a agenda; o detalhe fica na tela.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  // agrupa sessões de hoje por profissional
  const rows = await db
    .select({ userId: therapySessions.userId })
    .from(therapySessions)
    .where(and(gte(therapySessions.date, inicio), lt(therapySessions.date, fim), eq(therapySessions.status, "agendada")));

  const porUser = new Map<string, number>();
  for (const r of rows) porUser.set(r.userId, (porUser.get(r.userId) ?? 0) + 1);

  let enviados = 0;
  for (const [userId, n] of porUser) {
    const tokens = await tokensDoUsuario(userId);
    if (!tokens.length) continue;
    const r = await enviarPush(
      tokens,
      "Sua agenda de hoje",
      `Você tem ${n} sessão(ões) marcada(s) hoje.`,
      { type: "agenda" },
    );
    enviados += r.enviados;
  }
  return NextResponse.json({ ok: true, profissionais: porUser.size, enviados });
}
