import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, patientRecords, users } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AtenderClient } from "./AtenderClient";
import { jaasConfigured, jaasRoom, generateJaasJwt, JAAS_DOMAIN } from "@/lib/jaas";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AtenderPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();
  if (!UUID.test(sessionId)) notFound();
  const userId = session.user.id;

  const s = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
    with: { patient: { columns: { id: true, name: true, attendanceLocation: true } } },
  });
  if (!s) notFound();

  const records = await db.query.patientRecords.findMany({
    where: eq(patientRecords.patientId, s.patientId),
    orderBy: [desc(patientRecords.createdAt)],
    limit: 20,
  });
  const me = await db.query.users.findFirst({ where: eq(users.id, userId) });

  // Sala de vídeo (moderador = terapeuta via JaaS, se configurado)
  let meeting: { domain: string; room: string; jwt: string | null } | null = null;
  const baseRoom = `LEDivan-${s.id}`;
  if (jaasConfigured()) {
    const jwt = await generateJaasJwt({ name: me?.name || "Terapeuta", moderator: true, id: userId, email: me?.email });
    meeting = { domain: JAAS_DOMAIN, room: jaasRoom(baseRoom), jwt };
  } else {
    meeting = { domain: "meet.jit.si", room: baseRoom, jwt: null };
  }

  return (
    <AtenderClient
      session={{
        id: s.id, patientId: s.patientId, patientName: s.patient?.name ?? "Paciente",
        date: (s.date as Date).toISOString(), duration: s.duration, isOnline: s.isOnline,
        location: s.patient?.attendanceLocation ?? null, status: s.status,
      }}
      records={JSON.parse(JSON.stringify(records))}
      meeting={meeting}
      therapistName={me?.name || "Terapeuta"}
    />
  );
}
