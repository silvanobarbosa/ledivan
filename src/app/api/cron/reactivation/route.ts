import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients, therapySessions, users } from "@/db/schema";
import { notify } from "@/lib/messaging/engine";

// Campanha de reativação (cron semanal). Paciente ativo/pausado, opt-in, cuja ÚLTIMA sessão foi há
// mais de INACTIVE_DAYS e que não recebeu reativação nos últimos THROTTLE_DAYS → mensagem carinhosa
// de retorno pelo canal preferido (motor). Idempotente via patients.last_reactivation_at.
const INACTIVE_DAYS = 45;
const THROTTLE_DAYS = 30;
const MAX_PER_RUN = 100;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const now = Date.now();
  const inactiveCut = new Date(now - INACTIVE_DAYS * 86400000);
  const throttleCut = new Date(now - THROTTLE_DAYS * 86400000);

  const rows = await db.select({
    id: patients.id,
    userId: patients.userId,
    name: patients.name,
    phone: patients.phone,
    email: patients.email,
    reminderChannel: patients.reminderChannel,
    lastReactivationAt: patients.lastReactivationAt,
    therapistName: users.name,
    lastSession: sql<string | null>`max(${therapySessions.date})`,
  })
    .from(patients)
    .leftJoin(therapySessions, eq(therapySessions.patientId, patients.id))
    .leftJoin(users, eq(users.id, patients.userId))
    .where(and(ne(patients.reminderChannel, "none"), inArray(patients.patientStatus, ["ativo", "pausado"])))
    .groupBy(patients.id, users.name)
    .limit(1000);

  const due = rows.filter((r) =>
    r.lastSession &&
    new Date(r.lastSession).getTime() < inactiveCut.getTime() &&
    (!r.lastReactivationAt || new Date(r.lastReactivationAt).getTime() < throttleCut.getTime()),
  ).slice(0, MAX_PER_RUN);

  let sent = 0;
  for (const p of due) {
    const r = await notify({
      userId: p.userId,
      patient: { id: p.id, name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
      event: "reactivation",
      vars: { therapistName: p.therapistName ?? undefined },
    });
    if (r.ok) {
      sent++;
      await db.update(patients).set({ lastReactivationAt: new Date() }).where(eq(patients.id, p.id)).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, candidatos: due.length, enviados: sent });
}
