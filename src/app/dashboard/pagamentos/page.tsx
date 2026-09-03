import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, sessionPayments, patients } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Banknote } from "lucide-react";
import { monthlyReport, type PgSession, type PgPayment } from "@/lib/pagamentos";
import { PagamentosClient } from "./PagamentosClient";
import { getPreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const now = new Date();
  const year = Number((await searchParams).year) || now.getFullYear();
  const start = new Date(year, 0, 1), end = new Date(year, 11, 31, 23, 59, 59);

  const [sess, pays, pats] = await Promise.all([
    db.select({ patientId: therapySessions.patientId, fee: therapySessions.fee, date: therapySessions.date, status: therapySessions.status, chargeable: therapySessions.chargeable })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, start), lte(therapySessions.date, end))),
    db.select({ patientId: sessionPayments.patientId, amount: sessionPayments.amount, date: sessionPayments.date, method: sessionPayments.method, status: sessionPayments.status, kind: sessionPayments.kind })
      .from(sessionPayments).where(and(eq(sessionPayments.userId, userId), gte(sessionPayments.date, start), lte(sessionPayments.date, end))),
    db.select({ id: patients.id, name: patients.name, phone: patients.phone, status: patients.patientStatus }).from(patients).where(eq(patients.userId, userId)),
  ]);

  const prefs = await getPreferences(userId);
  const nameById = new Map(pats.map((p) => [p.id, p.name]));

  const fSessions: PgSession[] = sess.map((s) => ({ patientId: s.patientId, ym: ym(new Date(s.date)), fee: Number(s.fee) || 0, chargeable: s.chargeable, status: s.status }));
  const fPayments: PgPayment[] = pays.filter((p) => p.status === "paid").map((p) => ({ patientId: p.patientId, ym: ym(new Date(p.date)), amount: Number(p.amount) || 0, kind: p.kind }));

  const report = monthlyReport(year, fSessions, fPayments);

  // Detalhe por paciente de cada mês (enriquecido com nome), pronto pro client.
  const perMonthDetail = report.totals.map((_, i) =>
    report.patientsOfMonth(i)
      .map((d) => ({ ...d, name: nameById.get(d.patientId) ?? "—" }))
      .sort((a, b) => b.aberto - a.aberto || a.name.localeCompare(b.name)),
  );

  // Quadro 1 (por paciente): recebido por mês + info (métodos) — passa pagamentos leves.
  const paymentsLite = pays.filter((p) => p.status === "paid" && p.kind !== "pacote")
    .map((p) => ({ patientId: p.patientId, ym: ym(new Date(p.date)), amount: Number(p.amount) || 0, method: p.method ?? "" }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Banknote className="w-7 h-7" /> Pagamentos
        </h1>
        <p className="text-foreground/50 mt-1">Recebimentos por mês, por paciente e por total — com cobrança dos valores em aberto.</p>
      </div>
      <PagamentosClient
        year={year}
        months={report.months}
        totals={report.totals}
        perMonthDetail={perMonthDetail}
        patients={pats.filter((p) => p.status !== "inativo").map((p) => ({ id: p.id, name: p.name }))}
        payments={paymentsLite}
        currentMonth={year === now.getFullYear() ? now.getMonth() : -1}
        autoCobranca={!!prefs.autoCobranca}
      />
    </div>
  );
}
