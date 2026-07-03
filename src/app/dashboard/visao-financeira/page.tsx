import { db } from "@/db";
import { auth } from "@/auth";
import { patients, sessionPayments, therapySessions, patientPackages } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { VisaoFinanceiraClient } from "./VisaoFinanceiraClient";

export const dynamic = "force-dynamic";

export default async function VisaoFinanceiraPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [list, pays, debits, pkgs, lastSess] = await Promise.all([
    db.query.patients.findMany({
      where: and(eq(patients.userId, userId), sql`${patients.patientStatus} != 'prospect'`),
      columns: { id: true, name: true, patientStatus: true, sessionFee: true, frequency: true, priceReviewDate: true },
    }),
    db.select({ pid: sessionPayments.patientId, total: sql<string>`sum(${sessionPayments.amount})` })
      .from(sessionPayments).where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid"))).groupBy(sessionPayments.patientId),
    db.select({ pid: therapySessions.patientId, total: sql<string>`sum(${therapySessions.fee})`, cnt: sql<number>`count(*)::int` })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"), eq(therapySessions.chargeable, true))).groupBy(therapySessions.patientId),
    db.query.patientPackages.findMany({ where: eq(patientPackages.userId, userId), columns: { patientId: true, seq: true, sessions: true }, orderBy: [patientPackages.seq] }),
    db.select({ pid: therapySessions.patientId, last: sql<string>`max(${therapySessions.date})` })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"))).groupBy(therapySessions.patientId),
  ]);

  const paidMap = new Map(pays.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const debitMap = new Map(debits.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const chargedCntMap = new Map(debits.map((r) => [r.pid, Number(r.cnt || 0)]));
  const lastMap = new Map(lastSess.map((r) => [r.pid, r.last]));
  const pkgByPatient = new Map<string, { seq: number; sessions: number }[]>();
  for (const p of pkgs) { const a = pkgByPatient.get(p.patientId) ?? []; a.push({ seq: p.seq, sessions: p.sessions }); pkgByPatient.set(p.patientId, a); }

  const now = Date.now();
  const rows = list.map((p) => {
    const fee = parseFloat(p.sessionFee || "0") || 0;
    const balance = (paidMap.get(p.id) ?? 0) - (debitMap.get(p.id) ?? 0);
    const creditSessions = fee > 0 && balance > 0 ? Math.floor(balance / fee) : 0;
    const debtSessions = fee > 0 && balance < 0 ? Math.ceil(-balance / fee) : 0;

    // pacote vigente: consumo derivado (oldest-first) a partir das sessões realizadas+cobráveis
    const pk = (pkgByPatient.get(p.id) ?? []).sort((a, b) => a.seq - b.seq);
    let rem = chargedCntMap.get(p.id) ?? 0;
    let current: { seq: number; used: number; sessions: number } | null = null;
    for (const x of pk) {
      const used = Math.min(x.sessions, rem); rem -= used;
      if (used < x.sessions && !current) current = { seq: x.seq, used, sessions: x.sessions };
    }
    const reviewMs = p.priceReviewDate ? new Date(p.priceReviewDate as unknown as string).getTime() : null;
    const reajusteVencido = reviewMs != null && reviewMs <= now;
    const reajusteProximo = reviewMs != null && reviewMs > now && reviewMs <= now + 30 * 86400000;

    const situacao = balance < 0 ? "devedor" : creditSessions > 0 ? "credito" : "emdia";
    return {
      id: p.id, name: p.name, status: p.patientStatus, frequency: p.frequency,
      balance, creditSessions, debtSessions, situacao,
      pkg: current ? { seq: current.seq, pos: current.used, total: current.sessions } : null,
      priceReviewDate: p.priceReviewDate ? (p.priceReviewDate as unknown as string) : null,
      reajusteVencido, reajusteProximo,
      lastSession: lastMap.get(p.id) ?? null,
    };
  });

  return <VisaoFinanceiraClient rows={rows} />;
}
