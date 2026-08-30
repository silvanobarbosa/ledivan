import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patientDiary, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gate: só passa se o recurso diary estiver ligado (todos ou por-paciente).
async function gate(userId: string, patientId: string) {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return resolveFeature(prefs.features?.diary, parseOverrides(pat?.ov).diary);
}

// GET /api/patient/diary — entradas do próprio paciente (read own).
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const entries = await db.select({ id: patientDiary.id, content: patientDiary.content, mood: patientDiary.mood, createdAt: patientDiary.createdAt })
    .from(patientDiary)
    .where(and(eq(patientDiary.userId, p.userId), eq(patientDiary.patientId, p.patientId)))
    .orderBy(desc(patientDiary.createdAt))
    .limit(100);
  return NextResponse.json({ ok: true, entries });
}

const bodySchema = z.object({ content: z.string().trim().min(1).max(5000), mood: z.number().int().min(1).max(5).optional() });

// POST /api/patient/diary { content, mood? } — paciente escreve uma entrada.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Escreva algo (até 5000 caracteres)." }, { status: 400 });

  const [row] = await db.insert(patientDiary)
    .values({ userId: p.userId, patientId: p.patientId, content: parsed.data.content, mood: parsed.data.mood ?? null })
    .returning({ id: patientDiary.id, createdAt: patientDiary.createdAt });
  return NextResponse.json({ ok: true, id: row.id, createdAt: row.createdAt });
}
