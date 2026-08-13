import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients, sessionPayments } from "@/db/schema";
import { and, eq, gte, lt, desc, sql } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

/** Resumo financeiro do mês + últimos pagamentos. ?month=YYYY-MM (padrão: mês atual). */
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("month");
  const base = q && /^\d{4}-\d{2}$/.test(q) ? new Date(q + "-01T00:00:00") : new Date();
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 1);

  const [total] = await db
    .select({
      n: sql<number>`count(*)::int`,
      soma: sql<number>`coalesce(sum(${sessionPayments.amount}),0)::float`,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.userId, user.id), gte(sessionPayments.date, inicio), lt(sessionPayments.date, fim)));

  const ultimos = await db
    .select({
      id: sessionPayments.id,
      date: sessionPayments.date,
      amount: sessionPayments.amount,
      patientName: patients.name,
    })
    .from(sessionPayments)
    .innerJoin(patients, eq(patients.id, sessionPayments.patientId))
    .where(and(eq(sessionPayments.userId, user.id), gte(sessionPayments.date, inicio), lt(sessionPayments.date, fim)))
    .orderBy(desc(sessionPayments.date))
    .limit(30);

  return NextResponse.json({
    month: inicio.toISOString().slice(0, 7),
    total: total?.soma ?? 0,
    quantidade: total?.n ?? 0,
    pagamentos: ultimos,
  });
}
