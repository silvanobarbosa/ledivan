import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, patients, users } from "@/db/schema";
import { and, eq, ne, gte } from "drizzle-orm";
import { AgendaClient } from "./AgendaClient";
import { riskFromSessions } from "@/lib/therapy";
import { parseLocations } from "@/lib/locations";
import { parseHolidayCities, holidaysByDate } from "@/lib/holidays";

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Janela de exibição: últimos 120 dias (para cálculo de risco/histórico recente) em diante.
  const windowStart = new Date(); windowStart.setDate(windowStart.getDate() - 120);

  const [list, pats, me] = await Promise.all([
    db.query.therapySessions.findMany({
      where: and(eq(therapySessions.userId, session.user.id), gte(therapySessions.date, windowStart)),
      columns: { id: true, patientId: true, date: true, duration: true, status: true, isOnline: true, meetingUrl: true, meetingOpenedAt: true, guestJoinedAt: true, meetingEndedAt: true, pendingConfirmation: true, patientConfirmedAt: true, rescheduleRequestedAt: true, patientArrivedAt: true, location: true, recurring: true },
      with: { patient: { columns: { name: true } } },
    }),
    db.query.patients.findMany({
      where: and(eq(patients.userId, session.user.id), ne(patients.patientStatus, "inativo")),
      columns: { id: true, name: true, patientStatus: true, attendanceMode: true, attendanceLocation: true },
      orderBy: [patients.name],
    }),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);
  const locations = parseLocations(me?.attendanceLocations);

  // Feriados: cidades escolhidas pelo usuário (até 3). Busca anos relevantes (janela + ano atual + próximo).
  const holidayCities = parseHolidayCities(me?.holidayCities);
  const now = new Date();
  const years = Array.from(new Set([windowStart.getFullYear(), now.getFullYear(), now.getFullYear() + 1]));
  const holidayMap = await holidaysByDate(holidayCities, years);
  const holidays = Object.fromEntries(holidayMap);

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
          patientConfirmed: !!s.patientConfirmedAt,
          rescheduleRequested: !!s.rescheduleRequestedAt,
          patientArrived: !!s.patientArrivedAt,
          location: s.location,
          recurring: s.recurring,
        }))}
        patients={pats.map((p) => ({ id: p.id, name: p.name, status: p.patientStatus, attendanceMode: p.attendanceMode, attendanceLocation: p.attendanceLocation }))}
        locations={locations}
        holidays={holidays}
        holidayCities={holidayCities}
      />
    </div>
  );
}
