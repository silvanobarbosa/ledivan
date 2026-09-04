import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { JitsiRoom } from "@/components/dashboard/JitsiRoom";
import { jaasConfigured, jaasRoom, generateJaasJwt, JAAS_DOMAIN } from "@/lib/jaas";
import { meetingUrl } from "@/lib/therapy";

export const dynamic = "force-dynamic";

// Sala do PACIENTE (convidado) — pública, sem login. Token JaaS com moderator=false.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SalaConvidadoPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!UUID_RE.test(sessionId)) notFound();

  const s = await db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, sessionId),
    columns: { id: true, isOnline: true, meetingUrl: true, date: true, status: true },
  });
  if (!s || !s.isOnline) notFound();

  // Janela de tempo: o link é público (UUID imprevisível, mas ainda assim um link). Sem janela,
  // quem tivesse o link entrava na sala a QUALQUER momento — semanas depois, ou durante o
  // atendimento seguinte no mesmo id. Libera só de 15min antes até 3h depois do horário, e
  // recusa sessão cancelada/remarcada/não realizada.
  if (["cancelada", "realocada", "nao_realizada"].includes(s.status ?? "")) notFound();
  if (s.date) {
    const inicio = new Date(s.date).getTime();
    const agora = Date.now();
    if (agora < inicio - 15 * 60000 || agora > inicio + 3 * 3600000) notFound();
  }

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
