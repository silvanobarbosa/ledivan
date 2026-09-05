import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { patientDailyStatus, patients, users } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gated(userId: string, patientId: string): Promise<{ ok: boolean; ov: string | null }> {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return { ok: resolveFeature(prefs.features?.statusDia, parseOverrides(pat?.ov).statusDia), ov: pat?.ov ?? null };
}

// POST /api/patient/status { emoji, mood?, text? } — o paciente registra o status do dia.
// Gated no recurso statusDia. Avisa o terapeuta por push.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gated(p.userId, p.patientId)).ok) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let b: { emoji?: string; mood?: number; text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const emoji = (b.emoji || "").trim().slice(0, 16);
  if (!emoji) return NextResponse.json({ ok: false, error: "Escolha um emoji." }, { status: 400 });
  const mood = Number.isInteger(b.mood) && (b.mood as number) >= 1 && (b.mood as number) <= 5 ? b.mood : null;
  const text = (b.text || "").trim().slice(0, 1000) || null;

  const [row] = await db.insert(patientDailyStatus).values({
    userId: p.userId, patientId: p.patientId, emoji, mood, text,
  }).returning({ id: patientDailyStatus.id });

  // Avisa o terapeuta (best-effort).
  const [pat] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  const nome = (pat?.name || "Paciente").split(" ")[0];
  await pushToTherapist(p.userId, `${emoji} Status de ${nome}`, text || "Novo status do dia", { type: "status", patientId: p.patientId, statusId: row.id });

  return NextResponse.json({ ok: true, id: row.id });
}

// GET /api/patient/status — histórico do paciente (com a reação do terapeuta), p/ a curva de humor.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rows = await db.select({
    id: patientDailyStatus.id, emoji: patientDailyStatus.emoji, mood: patientDailyStatus.mood,
    text: patientDailyStatus.text, createdAt: patientDailyStatus.createdAt,
    reactionEmoji: patientDailyStatus.reactionEmoji, reactionText: patientDailyStatus.reactionText, reactionAt: patientDailyStatus.reactionAt,
  }).from(patientDailyStatus)
    .where(and(eq(patientDailyStatus.userId, p.userId), eq(patientDailyStatus.patientId, p.patientId)))
    .orderBy(desc(patientDailyStatus.createdAt)).limit(60);

  const enabled = (await gated(p.userId, p.patientId)).ok;
  return NextResponse.json({ enabled, statuses: rows });
}
