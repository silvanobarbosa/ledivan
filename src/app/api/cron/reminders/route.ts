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
    // Respeita a antecedência escolhida: dispara quando faltar <= lead.
    // Tolerância ao intervalo do cron: se a próxima execução só ocorrer DEPOIS
    // da sessão, manda agora (evita perder o lembrete em planos com cron diário).
    // Em cron de 15min, defina CRON_INTERVAL_MIN=15 para anteced. exata.
    const intervalMin = parseInt(process.env.CRON_INTERVAL_MIN || "1440");
    const lead = p.reminderLeadMinutes ?? 60;
    const minutesUntil = (new Date(s.date).getTime() - now.getTime()) / 60000;
    if (minutesUntil > lead && minutesUntil > intervalMin) { skipped++; continue; }
    const ok = await sendSessionReminder(
      s.userId,
      { name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
      { id: s.id, date: s.date, isOnline: s.isOnline, meetingUrl: s.meetingUrl },
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
