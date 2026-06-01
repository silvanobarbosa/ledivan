import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { and, eq, gte, lt, isNull, sql } from "drizzle-orm";
import { sendSessionReminder } from "@/lib/reminders";

// Cron diário (Vercel). Envia lembrete das sessões agendadas nas próximas ~28h
// para pacientes que optaram por receber, pelo canal escolhido. Idempotente via reminderSentAt.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const now = new Date();
  const until = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const sessions = await db.query.therapySessions.findMany({
    where: and(
      eq(therapySessions.status, "agendada"),
      gte(therapySessions.date, now),
      lt(therapySessions.date, until),
      isNull(therapySessions.reminderSentAt),
    ),
    with: { patient: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const s of sessions) {
    const p = s.patient;
    if (!p?.reminderEnabled) { skipped++; continue; }
    const ok = await sendSessionReminder(
      { name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
      { id: s.id, date: s.date, isOnline: s.isOnline },
    );
    if (ok) {
      await db.update(therapySessions)
        .set({ reminderSentAt: sql`now()` })
        .where(eq(therapySessions.id, s.id));
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, candidates: sessions.length, sent, skipped });
}
