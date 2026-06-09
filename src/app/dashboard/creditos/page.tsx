import { db } from "@/db";
import { auth } from "@/auth";
import { patients, sessionPayments, therapySessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { CreditosClient } from "./CreditosClient";

export const dynamic = "force-dynamic";

export default async function CreditosPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [list, pays, debits] = await Promise.all([
    db.query.patients.findMany({
      where: and(eq(patients.userId, userId), eq(patients.patientStatus, "ativo")),
      columns: { id: true, name: true, sessionFee: true, paymentFormat: true, attendanceDay: true, attendanceTime: true, tags: true },
    }),
    db.select({ pid: sessionPayments.patientId, total: sql<string>`sum(${sessionPayments.amount})` })
      .from(sessionPayments).where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid"))).groupBy(sessionPayments.patientId),
    db.select({ pid: therapySessions.patientId, total: sql<string>`sum(${therapySessions.fee})` })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"), eq(therapySessions.chargeable, true))).groupBy(therapySessions.patientId),
  ]);
  const paidMap = new Map(pays.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const debitMap = new Map(debits.map((r) => [r.pid, parseFloat(r.total || "0")]));

  const rows = list.map((p) => {
    const fee = parseFloat(p.sessionFee || "0") || 0;
    const balance = (paidMap.get(p.id) ?? 0) - (debitMap.get(p.id) ?? 0);
    const sessions = fee > 0 ? balance / fee : 0;
    return { id: p.id, name: p.name, balance, sessions, paymentFormat: p.paymentFormat, attendanceDay: p.attendanceDay, attendanceTime: p.attendanceTime, tags: p.tags };
  });

  return <CreditosClient rows={rows} />;
}
