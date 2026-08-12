import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients, therapySessions, sessionPayments } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

/** Resumo do dia para a Home do app. Protegido por token bearer. */
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const agora = new Date();
  const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  const [ativos] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(patients)
    .where(and(eq(patients.userId, user.id), eq(patients.patientStatus, "ativo")));

  const [hoje] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, user.id), gte(therapySessions.date, inicioDia), lte(therapySessions.date, fimDia)));

  const [mes] = await db
    .select({ total: sql<number>`coalesce(sum(${sessionPayments.amount}),0)::float` })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.userId, user.id), gte(sessionPayments.date, inicioMes), lte(sessionPayments.date, fimMes)));

  return NextResponse.json({
    pacientesAtivos: ativos?.n ?? 0,
    sessoesHoje: hoje?.n ?? 0,
    recebidoMes: mes?.total ?? 0,
  });
}
