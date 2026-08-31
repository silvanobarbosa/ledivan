import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessionPayments, users } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { pushToTherapist } from "@/lib/push";
import { sendProEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron mensal: lembra cada terapeuta dos recibos Receita Saúde ainda não emitidos.
export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET não roda.
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Conta pendentes por terapeuta (pagamentos reais, pagos, sem recibo emitido).
  const grouped = await db.select({ userId: sessionPayments.userId, pend: sql<number>`count(*)::int` })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.status, "paid"), isNull(sessionPayments.kind), isNull(sessionPayments.receiptIssuedAt)))
    .groupBy(sessionPayments.userId);

  let notified = 0;
  for (const g of grouped) {
    const n = Number(g.pend);
    if (n <= 0) continue;
    const title = "Receita Saúde — recibos pendentes";
    const body = `Você tem ${n} recibo(s) do Receita Saúde para emitir. Abra o Ledivan → Receita Saúde.`;

    await pushToTherapist(g.userId, title, body, { type: "receita-saude", pending: n });

    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, g.userId)).limit(1);
    if (u?.email) {
      await sendProEmail(
        g.userId, u.email, title,
        `<p>${body}</p><p>Os campos já vêm prontos para copiar no app oficial da Receita Federal.</p>`,
      ).catch(() => {});
    }
    notified++;
  }

  return NextResponse.json({ ok: true, therapists: grouped.length, notified });
}
