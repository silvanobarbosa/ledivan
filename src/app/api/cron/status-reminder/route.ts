import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients, patientDailyStatus } from "@/db/schema";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { pushToPatient } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron diário: lembra o paciente de mandar o "status do dia", na cadência que o terapeuta
// escolheu (statusReminderDays: 1=diário, 2/3 dias, 7=semanal). Só avisa se o recurso statusDia
// está ligado para o paciente E ele não mandou status nem recebeu lembrete dentro da janela.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const now = new Date();

  // candidatos: recurso de cadência ligado (>0), paciente ativo
  const candidatos = await db.select({
    id: patients.id, userId: patients.userId, name: patients.name,
    days: patients.statusReminderDays, lastReminder: patients.statusReminderLastAt, ov: patients.featureOverrides,
  }).from(patients)
    .where(and(gt(patients.statusReminderDays, 0), eq(patients.patientStatus, "ativo")));

  const prefsCache = new Map<string, Awaited<ReturnType<typeof getPreferences>>>();
  let enviados = 0;

  for (const c of candidatos) {
    const janelaMs = c.days * 24 * 60 * 60 * 1000;
    // já lembrado dentro da janela? pula (throttle)
    if (c.lastReminder && now.getTime() - new Date(c.lastReminder).getTime() < janelaMs) continue;

    // recurso ligado p/ este paciente?
    let prefs = prefsCache.get(c.userId);
    if (!prefs) { prefs = await getPreferences(c.userId); prefsCache.set(c.userId, prefs); }
    if (!resolveFeature(prefs.features?.statusDia, parseOverrides(c.ov).statusDia)) continue;

    // já mandou status dentro da janela? então não precisa lembrar
    const desde = new Date(now.getTime() - janelaMs);
    const [ultimo] = await db.select({ at: patientDailyStatus.createdAt }).from(patientDailyStatus)
      .where(and(eq(patientDailyStatus.patientId, c.id), gt(patientDailyStatus.createdAt, desde)))
      .orderBy(sql`${patientDailyStatus.createdAt} desc`).limit(1);
    if (ultimo) continue;

    const nome = (c.name || "").split(" ")[0];
    await pushToPatient(c.id, "Como você está hoje?", `${nome ? nome + ", que" : "Que"} tal registrar seu status do dia? 💬`, { type: "status_nudge" });
    await db.update(patients).set({ statusReminderLastAt: now }).where(eq(patients.id, c.id));
    enviados++;
  }

  return NextResponse.json({ ok: true, candidatos: candidatos.length, enviados });
}
