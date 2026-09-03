import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, patients, patientPriceHistory } from "@/db/schema";
import { and, eq, gte, ne } from "drizzle-orm";
import { TrendingUp } from "lucide-react";
import { monthKeys, buildForecast, PERIODO_MES, type FSession, type FRecurring, type FPriceChange } from "@/lib/forecast";
import { PrevisaoCharts } from "./PrevisaoCharts";

export const dynamic = "force-dynamic";

const HORIZON = 12;
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function PrevisaoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const keys = monthKeys(now.getFullYear(), now.getMonth(), HORIZON);

  const [futSessions, pats, priceHist] = await Promise.all([
    db.select({ date: therapySessions.date, fee: therapySessions.fee, packageId: therapySessions.packageId, patientId: therapySessions.patientId })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "agendada"), eq(therapySessions.chargeable, true), gte(therapySessions.date, monthStart))),
    db.select({ id: patients.id, name: patients.name, frequency: patients.frequency, timesPerPeriod: patients.timesPerPeriod, sessionFee: patients.sessionFee, status: patients.patientStatus })
      .from(patients).where(and(eq(patients.userId, userId), ne(patients.patientStatus, "inativo"), ne(patients.patientStatus, "prospect"))),
    db.select({ patientId: patientPriceHistory.patientId, valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
      .from(patientPriceHistory).where(gte(patientPriceHistory.dataEfetiva, monthStart)),
  ]);

  const nameById = new Map(pats.map((p) => [p.id, p.name]));
  const feeById = new Map(pats.map((p) => [p.id, Number(p.sessionFee) || 0]));

  const sessions: FSession[] = futSessions.map((s) => ({
    ym: ym(new Date(s.date)), fee: Number(s.fee) || 0, packageId: s.packageId, patientId: s.patientId,
  }));

  // Recorrentes: pacientes com frequência reconhecida → sessões esperadas/mês.
  const recurring: FRecurring[] = pats
    .filter((p) => p.frequency && PERIODO_MES[p.frequency] !== undefined)
    .map((p) => ({ patientId: p.id, fee: Number(p.sessionFee) || 0, perMonth: (PERIODO_MES[p.frequency!] ?? 0) * (p.timesPerPeriod || 1) }))
    .filter((r) => r.perMonth > 0 && r.fee > 0);

  const priceChanges: FPriceChange[] = priceHist
    .map((pc) => ({ patientId: pc.patientId, ym: ym(new Date(pc.dataEfetiva!)), newFee: Number(pc.valor) || 0, oldFee: feeById.get(pc.patientId) ?? 0 }))
    .filter((pc) => pc.newFee !== pc.oldFee);

  const forecast = buildForecast(keys, sessions, recurring, priceChanges);

  // Por paciente (top por total previsto no horizonte).
  const patientIds = new Set<string>([...sessions.map((s) => s.patientId), ...recurring.map((r) => r.patientId)]);
  const perPatient = [...patientIds].map((pid) => {
    const f = buildForecast(
      keys,
      sessions.filter((s) => s.patientId === pid),
      recurring.filter((r) => r.patientId === pid),
      priceChanges.filter((pc) => pc.patientId === pid),
    );
    return { id: pid, name: nameById.get(pid) ?? "—", total: f.subtotals.total, sub: f.subtotals };
  }).filter((p) => p.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <TrendingUp className="w-7 h-7" /> Previsão de receita
        </h1>
        <p className="text-foreground/50 mt-1">Ganhos previstos nos próximos {HORIZON} meses — separados por origem, geral e por paciente.</p>
      </div>
      <PrevisaoCharts forecast={forecast} perPatient={perPatient} />
    </div>
  );
}
