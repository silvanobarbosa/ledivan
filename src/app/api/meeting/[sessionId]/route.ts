import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Registra eventos da sala de vídeo embutida na sessão (somente o terapeuta dono).
// body: { event: "opened" | "guest" | "ended" }
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: { event?: string } = {};
  try { body = await req.json(); } catch {}
  const event = body.event;

  const s = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)),
  });
  if (!s) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

  const now = new Date();
  const patch: Partial<typeof therapySessions.$inferInsert> = {};

  if (event === "opened") {
    patch.meetingHappened = true;
    if (!s.meetingOpenedAt) patch.meetingOpenedAt = now;
  } else if (event === "guest") {
    patch.meetingHappened = true;
    if (!s.guestJoinedAt) patch.guestJoinedAt = now;
  } else if (event === "ended") {
    patch.meetingEndedAt = now;
  } else {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }

  await db.update(therapySessions)
    .set(patch)
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
