import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions, sessionPayments, patients, users } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getPreferences } from "@/lib/preferences";
import { monthlyReport, type PgSession, type PgPayment } from "@/lib/pagamentos";
import { cobrancaTexto } from "@/app/dashboard/pagamentos/actions";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Cron mensal: para cada terapeuta com autoCobranca ligada, cobra os valores EM ABERTO do mês corrente.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  const now = new Date();
  const year = now.getFullYear(), monthIdx = now.getMonth();
  const start = new Date(year, 0, 1), end = new Date(year, 11, 31, 23, 59, 59);

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
  let sent = 0, therapists = 0;

  for (const u of allUsers) {
    const prefs = await getPreferences(u.id);
    if (!prefs.autoCobranca) continue;
    therapists++;

    const [sess, pays, pats] = await Promise.all([
      db.select({ patientId: therapySessions.patientId, fee: therapySessions.fee, date: therapySessions.date, status: therapySessions.status, chargeable: therapySessions.chargeable })
        .from(therapySessions).where(and(eq(therapySessions.userId, u.id), gte(therapySessions.date, start), lte(therapySessions.date, end))),
      db.select({ patientId: sessionPayments.patientId, amount: sessionPayments.amount, date: sessionPayments.date, status: sessionPayments.status, kind: sessionPayments.kind })
        .from(sessionPayments).where(and(eq(sessionPayments.userId, u.id), gte(sessionPayments.date, start), lte(sessionPayments.date, end))),
      db.select({ id: patients.id, name: patients.name, phone: patients.phone }).from(patients).where(eq(patients.userId, u.id)),
    ]);

    const fSessions: PgSession[] = sess.map((s) => ({ patientId: s.patientId, ym: ym(new Date(s.date)), fee: Number(s.fee) || 0, chargeable: s.chargeable, status: s.status }));
    const fPayments: PgPayment[] = pays.filter((p) => p.status === "paid").map((p) => ({ patientId: p.patientId, ym: ym(new Date(p.date)), amount: Number(p.amount) || 0, kind: p.kind }));
    const report = monthlyReport(year, fSessions, fPayments);
    const abertos = report.patientsOfMonth(monthIdx).filter((d) => d.aberto > 0.005);
    const phoneById = new Map(pats.map((p) => [p.id, p.phone]));

    for (const d of abertos) {
      const phone = phoneById.get(d.patientId);
      if (!phone) continue;
      const nome = pats.find((p) => p.id === d.patientId)?.name || "Paciente";
      const ok = await sendWhatsappFromUser(u.id, phone, cobrancaTexto(nome, d.aberto, monthIdx, u.name || "Seu terapeuta"));
      if (ok) sent++;
    }
  }

  return NextResponse.json({ ok: true, therapists, sent });
}
