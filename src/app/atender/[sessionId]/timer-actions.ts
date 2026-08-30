"use server";

import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";

export async function startSessionTimer(sessionId: string): Promise<{ ok: boolean; startedAt?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const now = new Date();
  await db.update(therapySessions).set({ timerStartedAt: now, timerEndedAt: null })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, s.user.id)));
  return { ok: true, startedAt: now.toISOString() };
}

export async function stopSessionTimer(sessionId: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.update(therapySessions).set({ timerEndedAt: new Date() })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, s.user.id)));
  return { ok: true };
}
