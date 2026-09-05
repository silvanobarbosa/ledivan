import { NextResponse } from "next/server";
import { and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { patientDailyStatus, patients } from "@/db/schema";
import { userFromBearer } from "@/lib/app-auth";
import { pushToPatient } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/app/status?patientId= — status do dia de um paciente (últimos + marca como visto).
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const patientId = new URL(req.url).searchParams.get("patientId");
  if (!patientId) return NextResponse.json({ error: "patientId obrigatório." }, { status: 400 });

  // posse: o paciente é do terapeuta?
  const [own] = await db.select({ id: patients.id }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, user.id))).limit(1);
  if (!own) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  const rows = await db.select().from(patientDailyStatus)
    .where(and(eq(patientDailyStatus.userId, user.id), eq(patientDailyStatus.patientId, patientId)))
    .orderBy(desc(patientDailyStatus.createdAt)).limit(60);

  // marca os não vistos como vistos (o terapeuta consultou)
  if (rows.some((r) => !r.seenByTherapistAt)) {
    await db.update(patientDailyStatus).set({ seenByTherapistAt: new Date() })
      .where(and(eq(patientDailyStatus.userId, user.id), eq(patientDailyStatus.patientId, patientId), isNull(patientDailyStatus.seenByTherapistAt))).catch(() => {});
  }
  return NextResponse.json({ statuses: rows });
}

// POST /api/app/status { statusId, emoji, text? } — o terapeuta REAGE ao status; a reação volta
// ao paciente por push.
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let b: { statusId?: string; emoji?: string; text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const statusId = (b.statusId || "").trim();
  const emoji = (b.emoji || "").trim().slice(0, 16);
  const text = (b.text || "").trim().slice(0, 500) || null;
  if (!statusId || !emoji) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  // só reage num status do próprio terapeuta
  const [st] = await db.select({ id: patientDailyStatus.id, patientId: patientDailyStatus.patientId })
    .from(patientDailyStatus).where(and(eq(patientDailyStatus.id, statusId), eq(patientDailyStatus.userId, user.id))).limit(1);
  if (!st) return NextResponse.json({ ok: false, error: "Status não encontrado." }, { status: 404 });

  await db.update(patientDailyStatus).set({ reactionEmoji: emoji, reactionText: text, reactionAt: new Date() })
    .where(eq(patientDailyStatus.id, statusId));

  await pushToPatient(st.patientId, "Seu terapeuta viu seu status 💚", `${emoji}${text ? " " + text : ""}`, { type: "status_reaction" });
  return NextResponse.json({ ok: true });
}
