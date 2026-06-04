import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { JitsiRoom } from "@/components/dashboard/JitsiRoom";
import { jaasConfigured, jaasRoom, generateJaasJwt, JAAS_DOMAIN } from "@/lib/jaas";
import { meetingUrl } from "@/lib/therapy";

export const dynamic = "force-dynamic";

// Sala do PACIENTE (convidado) — pública, sem login. Token JaaS com moderator=false.
export default async function SalaConvidadoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const s = await db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, sessionId),
    columns: { id: true, isOnline: true, meetingUrl: true },
  });
  if (!s || !s.isOnline) notFound();

  // Google Meet salvo → manda direto
  if (s.meetingUrl && s.meetingUrl.includes("meet.google.com")) redirect(s.meetingUrl);

  const baseRoom = `LEDivan-${s.id}`;

  // Sem JaaS: sala pública meet.jit.si (convidado entra normal)
  if (!jaasConfigured()) redirect(meetingUrl(s.id));

  const jwt = await generateJaasJwt({ name: "Convidado", moderator: false, id: "guest" });

  return (
    <JitsiRoom
      roomName={jaasRoom(baseRoom)}
      displayName="Convidado"
      sessionId={s.id}
      domain={JAAS_DOMAIN}
      jwt={jwt}
      reportEvents={false}
      onLeaveHref="/"
    />
  );
}
