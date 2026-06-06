import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, patients, users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { AgendaClient } from "./AgendaClient";
import { riskFromSessions } from "@/lib/therapy";
import { parseLocations } from "@/lib/locations";

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.query.therapySessions.findMany({
    where: eq(therapySessions.userId, session.user.id),
    with: { patient: { columns: { name: true } } },
  });

  // pacientes p/ o seletor de novo atendimento (exclui inativos)
  const pats = await db.query.patients.findMany({
    where: and(eq(patients.userId, session.user.id), ne(patients.patientStatus, "inativo")),
    columns: { id: true, name: true, patientStatus: true, attendanceMode: true, attendanceLocation: true },
    orderBy: [patients.name],
  });
  const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const locations = parseLocations(me?.attendanceLocations);

  // risco de falta por paciente (calculado sobre o histórico completo)
  const byPatient = new Map<string, { status: string; date: Date }[]>();
  for (const s of list) {
    const arr = byPatient.get(s.patientId) ?? [];
    arr.push({ status: s.status, date: s.date as Date });
    byPatient.set(s.patientId, arr);
  }
  const riskByPatient = new Map<string, string>();
  for (const [pid, sess] of byPatient) riskByPatient.set(pid, riskFromSessions(sess).level);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Agenda</h1>
        <p className="text-foreground/50 mt-1">Sessões da semana</p>
      </div>
      <AgendaClient
        sessions={list.map((s) => ({
          id: s.id,
          date: s.date as unknown as string,
          duration: s.duration,
          status: s.status,
          isOnline: s.isOnline,
          meetingUrl: s.meetingUrl,
          patientName: s.patient?.name ?? "—",
          risk: riskByPatient.get(s.patientId) ?? "baixo",
          meetingOpenedAt: s.meetingOpenedAt ? (s.meetingOpenedAt as unknown as string) : null,
          guestJoinedAt: s.guestJoinedAt ? (s.guestJoinedAt as unknown as string) : null,
          meetingEndedAt: s.meetingEndedAt ? (s.meetingEndedAt as unknown as string) : null,
          pendingConfirmation: s.pendingConfirmation,
          location: s.location,
        }))}
        patients={pats.map((p) => ({ id: p.id, name: p.name, status: p.patientStatus, attendanceMode: p.attendanceMode, attendanceLocation: p.attendanceLocation }))}
        locations={locations}
      />
    </div>
  );
}
