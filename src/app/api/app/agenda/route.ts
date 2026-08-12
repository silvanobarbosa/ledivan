import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients, therapySessions } from "@/db/schema";
import { and, eq, gte, lt, asc } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

/** Sessões de um dia (agenda). ?date=YYYY-MM-DD (padrão: hoje). */
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const q = new URL(req.url).searchParams.get("date");
  const base = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(q + "T00:00:00") : new Date();
  const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: therapySessions.id,
      date: therapySessions.date,
      status: therapySessions.status,
      patientName: patients.name,
      patientId: patients.id,
    })
    .from(therapySessions)
    .innerJoin(patients, eq(patients.id, therapySessions.patientId))
    .where(and(eq(therapySessions.userId, user.id), gte(therapySessions.date, inicio), lt(therapySessions.date, fim)))
    .orderBy(asc(therapySessions.date));

  return NextResponse.json({ date: inicio.toISOString().slice(0, 10), sessions: rows });
}
