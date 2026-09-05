import { db } from "@/db";
import { auth } from "@/auth";
import { users, patients, therapySessions, sessionPayments, patientStatusHistory, patientPriceHistory, patientContractHistory, patientRecords, assignments, moodLogs, scaleApplications, treatmentGoals, patientPackages, patientDiary, sessionRatings, patientConsents, patientWriting } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientDetail } from "./PatientDetail";
import { riskFromSessions } from "@/lib/therapy";
import { parseLocations } from "@/lib/locations";
import { derivePackageLabels } from "@/lib/packages";
import { resolveFeature, parseOverrides } from "@/lib/features";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.userId, userId)),
  });
  if (!patient) notFound();

  // Todas as consultas do paciente em paralelo (evita waterfall de round-trips no Neon)
  const [sessionsList, paymentsList, statusHist, priceHist, recordsList, assignmentsList, moodList, scaleList, goalsList, contractHist, me, packagesList, diaryList, ratingsList, consentsList] = await Promise.all([
    db.query.therapySessions.findMany({ where: eq(therapySessions.patientId, id), orderBy: [desc(therapySessions.date)] }),
    db.query.sessionPayments.findMany({ where: eq(sessionPayments.patientId, id), orderBy: [desc(sessionPayments.date)] }),
    db.query.patientStatusHistory.findMany({ where: eq(patientStatusHistory.patientId, id), orderBy: [desc(patientStatusHistory.date)] }),
    db.query.patientPriceHistory.findMany({ where: eq(patientPriceHistory.patientId, id), orderBy: [desc(patientPriceHistory.dataEfetiva)] }),
    db.query.patientRecords.findMany({ where: eq(patientRecords.patientId, id), orderBy: [desc(patientRecords.createdAt)] }),
    db.query.assignments.findMany({ where: eq(assignments.patientId, id), orderBy: [desc(assignments.createdAt)] }),
    db.query.moodLogs.findMany({ where: eq(moodLogs.patientId, id), orderBy: [desc(moodLogs.loggedAt)], limit: 60 }),
    db.query.scaleApplications.findMany({ where: eq(scaleApplications.patientId, id), orderBy: [desc(scaleApplications.createdAt)] }),
    db.query.treatmentGoals.findMany({ where: eq(treatmentGoals.patientId, id), orderBy: [desc(treatmentGoals.createdAt)] }),
    db.query.patientContractHistory.findMany({ where: eq(patientContractHistory.patientId, id), orderBy: [desc(patientContractHistory.date)] }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.patientPackages.findMany({ where: eq(patientPackages.patientId, id), orderBy: [patientPackages.seq] }),
    db.query.patientDiary.findMany({ where: eq(patientDiary.patientId, id), orderBy: [desc(patientDiary.createdAt)], limit: 100 }),
    db.query.sessionRatings.findMany({ where: eq(sessionRatings.patientId, id), orderBy: [desc(sessionRatings.createdAt)], limit: 100 }),
    db.query.patientConsents.findMany({ where: eq(patientConsents.patientId, id), orderBy: [desc(patientConsents.acceptedAt)], limit: 20 }),
  ]);

  const prefs = (() => { try { return me?.preferences ? JSON.parse(me.preferences) : {}; } catch { return {}; } })();
  const locations = parseLocations(me?.attendanceLocations);
  const statusEnabled = resolveFeature(prefs.features?.statusDia, parseOverrides(patient.featureOverrides).statusDia);

  // Escritas terapêuticas COMPARTILHADAS pelo paciente (as privadas nunca chegam ao terapeuta).
  const sharedWritings = await db.select({ id: patientWriting.id, promptTitle: patientWriting.promptTitle, content: patientWriting.content, sharedAt: patientWriting.sharedAt, createdAt: patientWriting.createdAt })
    .from(patientWriting)
    .where(and(eq(patientWriting.patientId, id), eq(patientWriting.shared, true)))
    .orderBy(desc(patientWriting.createdAt)).limit(30);

  // Estatísticas de sessões p/ os cards do paciente
  const nowMs = Date.now();
  const realizadas = sessionsList.filter((s) => s.status === "realizada");
  const lastRealizada = realizadas.map((s) => new Date(s.date as unknown as string).getTime()).sort((a, b) => b - a)[0];
  const sessionStats = {
    reservadas: sessionsList.filter((s) => s.pendingConfirmation && new Date(s.date as unknown as string).getTime() >= nowMs).length,
    agendadasFuturas: sessionsList.filter((s) => s.status === "agendada" && new Date(s.date as unknown as string).getTime() >= nowMs).length,
    realizadasCount: realizadas.length,
    lastRealizada: lastRealizada ? new Date(lastRealizada).toISOString() : null,
  };

  // Pacotes (P1, P2, ...): consumo DERIVADO das sessões realizadas+cobráveis (oldest-first),
  // assim o saldo é sempre coerente independe de quando o pacote/sessão foi criado.
  const realizedChargeableCount = sessionsList.filter((s) => s.status === "realizada" && s.chargeable).length;
  let remCount = realizedChargeableCount;
  const packages = packagesList.map((p) => {
    const used = Math.min(p.sessions, remCount);
    remCount -= used;
    return { id: p.id, seq: p.seq, sessions: p.sessions, used, remaining: p.sessions - used };
  });
  const openPkgs = packages.filter((p) => p.remaining > 0);
  const pkgSeqById = new Map(packagesList.map((p) => [p.id, p.seq]));
  const packageInfo = {
    list: packages,
    openSessions: openPkgs.reduce((a, p) => a + p.remaining, 0),
    currentLabel: openPkgs.map((p) => `P${p.seq}`).join("+") || null,
    openLabels: openPkgs.map((p) => `P${p.seq}`),
    totalSessions: packages.reduce((a, p) => a + p.sessions, 0),
  };

  // Agenda recorrente (a partir das reservas recurring futuras)
  const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const recSessions = sessionsList.filter((s) => s.recurring && new Date(s.date as unknown as string).getTime() >= nowMs).sort((a, b) => new Date(a.date as unknown as string).getTime() - new Date(b.date as unknown as string).getTime());
  let recurring: { day: string; time: string; until: string | null } | null = null;
  if (recSessions.length) {
    const d = new Date(recSessions[0].date as unknown as string);
    const untilMax = recSessions.map((s) => s.recurrenceUntil ? new Date(s.recurrenceUntil as unknown as string).getTime() : 0).sort((a, b) => b - a)[0];
    recurring = { day: DOW[d.getDay()], time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), until: untilMax ? new Date(untilMax).toISOString() : null };
  }

  // --- Fluxo financeiro universal: pagamentos (+) e sessões realizadas+cobráveis (−) ---
  const fee = parseFloat(patient.sessionFee || "0") || 0;
  const paidPayments = paymentsList.filter((p) => p.status === "paid");
  // índice X/N por pagamento vinculado a pacote (X = enésimo pagamento desse pacote)
  const pkgSessById = new Map(packagesList.map((p) => [p.id, p.sessions]));
  const payPkgIdx = new Map<string, number>();
  const pkgCnt: Record<string, number> = {};
  [...paidPayments].filter((p) => p.packageId).sort((a, b) => new Date(a.date as unknown as string).getTime() - new Date(b.date as unknown as string).getTime()).forEach((p) => {
    pkgCnt[p.packageId!] = (pkgCnt[p.packageId!] || 0) + 1;
    payPkgIdx.set(p.id, pkgCnt[p.packageId!]);
  });
  type LedgerItem = { id: string; date: string; kind: "pagamento" | "sessao"; desc: string; amount: number; payId: string | null };
  const ledgerRaw: LedgerItem[] = [
    ...paidPayments.map((p) => ({ id: `p${p.id}`, date: p.date as unknown as string, kind: "pagamento" as const, desc: p.kind === "pacote" ? "Crédito de pacote" : (p.packageId && pkgSeqById.has(p.packageId)) ? `Pagamento — Pacote P${pkgSeqById.get(p.packageId)} · ${payPkgIdx.get(p.id) ?? 1}/${pkgSessById.get(p.packageId) ?? "?"}` : "Pagamento recebido", amount: parseFloat(p.amount), payId: p.kind === "pacote" ? null : p.id })),
    ...sessionsList
      .filter((s) => s.status === "realizada" && s.chargeable)
      .map((s) => ({ id: `s${s.id}`, date: s.date as unknown as string, kind: "sessao" as const, desc: "Sessão realizada (cobrança)", amount: -parseFloat(s.fee), payId: null })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const ledger = ledgerRaw.map((it) => { running += it.amount; return { ...it, balance: running }; }).reverse();
  const balance = running;
  const totalPaid = paidPayments.reduce((a, p) => a + parseFloat(p.amount), 0);
  const totalDebit = sessionsList.filter((s) => s.status === "realizada" && s.chargeable).reduce((a, s) => a + parseFloat(s.fee), 0);
  const lastPay = paidPayments.slice().sort((a, b) => new Date(b.date as unknown as string).getTime() - new Date(a.date as unknown as string).getTime())[0];
  const finance = {
    fee,
    balance,
    totalPaid,
    totalDebit,
    atendimentos: sessionsList.filter((s) => s.status === "realizada").length,
    lastPaymentDate: lastPay ? (lastPay.date as unknown as string) : null,
    lastPaymentAmount: lastPay ? parseFloat(lastPay.amount) : null,
    creditSessions: fee > 0 && balance > 0 ? Math.floor(balance / fee) : 0,
    debtSessions: fee > 0 && balance < 0 ? Math.ceil(-balance / fee) : 0,
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Pacientes
      </Link>

      <PatientDetail
        patient={JSON.parse(JSON.stringify(patient))}
        sessions={JSON.parse(JSON.stringify(sessionsList))}
        packageLabels={Object.fromEntries(derivePackageLabels(
          sessionsList.map((s) => ({ id: s.id, date: s.date as unknown as string, status: s.status, packageId: s.packageId })),
          packagesList.map((p) => ({ id: p.id, seq: p.seq, sessions: p.sessions })),
        ))}
        payments={JSON.parse(JSON.stringify(paymentsList))}
        statusHistory={JSON.parse(JSON.stringify(statusHist))}
        priceHistory={JSON.parse(JSON.stringify(priceHist))}
        records={JSON.parse(JSON.stringify(recordsList))}
        transcriptionEnabled={!!prefs.transcriptionEnabled}
        risk={riskFromSessions(sessionsList.map((s) => ({ status: s.status, date: s.date as Date })))}
        assignments={JSON.parse(JSON.stringify(assignmentsList))}
        moodToken={patient.moodToken}
        moodLogs={JSON.parse(JSON.stringify(moodList))}
        scales={JSON.parse(JSON.stringify(scaleList))}
        treatmentGoals={JSON.parse(JSON.stringify(goalsList))}
        diaryEntries={JSON.parse(JSON.stringify(diaryList))}
        ratings={JSON.parse(JSON.stringify(ratingsList))}
        consents={JSON.parse(JSON.stringify(consentsList))}
        locations={locations}
        contractHistory={JSON.parse(JSON.stringify(contractHist))}
        finance={finance}
        ledger={JSON.parse(JSON.stringify(ledger))}
        sessionStats={sessionStats}
        packageInfo={packageInfo}
        recurring={recurring}
        statusEnabled={statusEnabled}
        sharedWritings={JSON.parse(JSON.stringify(sharedWritings))}
      />
    </div>
  );
}
