import { db } from "@/db";
import { auth } from "@/auth";
import { patients, therapySessions, sessionPayments, patientStatusHistory, patientPriceHistory } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientDetail } from "./PatientDetail";
import { getPreferences } from "@/lib/preferences";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.userId, userId)),
  });
  if (!patient) notFound();

  const [sessionsList, paymentsList, statusHist, priceHist, prefs] = await Promise.all([
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
    getPreferences(userId),
  ]);

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
        autoLinkPayments={!!prefs.autoLinkPayments}
      />
    </div>
  );
}
