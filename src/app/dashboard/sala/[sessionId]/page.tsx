import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { JitsiRoom } from "@/components/dashboard/JitsiRoom";
import { jaasConfigured, jaasRoom, generateJaasJwt, JAAS_DOMAIN } from "@/lib/jaas";

// Sala de vídeo embutida do terapeuta (anfitrião). Tela cheia, fora do layout visual.
export default async function SalaPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const s = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)),
  });
  if (!s) notFound();

  const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const baseRoom = `LEDivan-${s.id}`;

  // Com JaaS: terapeuta SEMPRE moderador (token moderator=true), independente da ordem.
  if (jaasConfigured()) {
    const jwt = await generateJaasJwt({
      name: me?.name || "Terapeuta",
      moderator: true,
      id: session.user.id,
      email: me?.email,
    });
    return (
      <JitsiRoom
        roomName={jaasRoom(baseRoom)}
        displayName={me?.name || "Terapeuta"}
        sessionId={s.id}
        domain={JAAS_DOMAIN}
        jwt={jwt}
      />
    );
  }

  // Fallback: meet.jit.si público (moderador = primeiro a entrar).
  return (
    <JitsiRoom
      roomName={baseRoom}
      displayName={me?.name || "Terapeuta"}
      sessionId={s.id}
    />
  );
}
