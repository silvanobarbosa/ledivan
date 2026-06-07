import { db } from "@/db";
import { auth } from "@/auth";
import { users, patients, therapySessions, sessionPayments, patientStatusHistory, patientPriceHistory, patientContractHistory, patientRecords, assignments, moodLogs, scaleApplications, treatmentGoals } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientDetail } from "./PatientDetail";
import { getPreferences } from "@/lib/preferences";
import { riskFromSessions } from "@/lib/therapy";
import { parseLocations } from "@/lib/locations";

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

  const [sessionsList, paymentsList, statusHist, priceHist, recordsList, prefs] = await Promise.all([
    db.query.therapySessions.findMany({
      where: eq(therapySessions.patientId, id),
      orderBy: [desc(therapySessions.date)],
    }),
    db.query.sessionPayments.findMany({
      where: eq(sessionPayments.patientId, id),
      orderBy: [desc(sessionPayments.date)],
    }),
    db.query.patientStatusHistory.findMany({
      where: eq(patientStatusHistory.patientId, id),
      orderBy: [desc(patientStatusHistory.date)],
    }),
    db.query.patientPriceHistory.findMany({
      where: eq(patientPriceHistory.patientId, id),
      orderBy: [desc(patientPriceHistory.dataEfetiva)],
    }),
    db.query.patientRecords.findMany({
      where: eq(patientRecords.patientId, id),
      orderBy: [desc(patientRecords.createdAt)],
    }),
    getPreferences(userId),
  ]);

  const assignmentsList = await db.query.assignments.findMany({
    where: eq(assignments.patientId, id),
    orderBy: [desc(assignments.createdAt)],
  });

  const moodList = await db.query.moodLogs.findMany({
    where: eq(moodLogs.patientId, id),
    orderBy: [desc(moodLogs.loggedAt)],
    limit: 60,
  });

  const scaleList = await db.query.scaleApplications.findMany({
    where: eq(scaleApplications.patientId, id),
    orderBy: [desc(scaleApplications.createdAt)],
  });

  const goalsList = await db.query.treatmentGoals.findMany({
    where: eq(treatmentGoals.patientId, id),
    orderBy: [desc(treatmentGoals.createdAt)],
  });

  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const locations = parseLocations(me?.attendanceLocations);

  const contractHist = await db.query.patientContractHistory.findMany({
    where: eq(patientContractHistory.patientId, id),
    orderBy: [desc(patientContractHistory.date)],
  });

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Pacientes
      </Link>

      <PatientDetail
        patient={JSON.parse(JSON.stringify(patient))}
        sessions={JSON.parse(JSON.stringify(sessionsList))}
        payments={JSON.parse(JSON.stringify(paymentsList))}
        statusHistory={JSON.parse(JSON.stringify(statusHist))}
        priceHistory={JSON.parse(JSON.stringify(priceHist))}
        records={JSON.parse(JSON.stringify(recordsList))}
        autoLinkPayments={!!prefs.autoLinkPayments}
        transcriptionEnabled={!!prefs.transcriptionEnabled}
        risk={riskFromSessions(sessionsList.map((s) => ({ status: s.status, date: s.date as Date })))}
        assignments={JSON.parse(JSON.stringify(assignmentsList))}
        moodToken={patient.moodToken}
        moodLogs={JSON.parse(JSON.stringify(moodList))}
        scales={JSON.parse(JSON.stringify(scaleList))}
        treatmentGoals={JSON.parse(JSON.stringify(goalsList))}
        locations={locations}
        contractHistory={JSON.parse(JSON.stringify(contractHist))}
      />
    </div>
  );
}
