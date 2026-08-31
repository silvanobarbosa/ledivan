import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { scaleApplications, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { SCALES, type ScaleType } from "@/lib/scales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(userId: string, patientId: string) {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return resolveFeature(prefs.features?.scales, parseOverrides(pat?.ov).scales);
}

// GET /api/patient/scales — escalas pendentes do paciente (com perguntas e opções).
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const apps = await db.select({ id: scaleApplications.id, scaleType: scaleApplications.scaleType })
    .from(scaleApplications)
    .where(and(eq(scaleApplications.userId, p.userId), eq(scaleApplications.patientId, p.patientId), eq(scaleApplications.status, "pendente")))
    .orderBy(desc(scaleApplications.id));

  const pending = apps.flatMap((a) => {
    const scale = SCALES[a.scaleType as ScaleType];
    if (!scale) return [];
    return [{ id: a.id, scaleType: a.scaleType, name: scale.name, short: scale.short, intro: scale.intro, items: scale.items, options: scale.options }];
  });
  return NextResponse.json({ ok: true, pending });
}

const bodySchema = z.object({ id: z.string().uuid(), answers: z.array(z.number().int().min(0).max(3)) });

// POST /api/patient/scales { id, answers } — responde uma escala; auto-pontua e interpreta.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  // A aplicação tem que ser deste paciente e estar pendente (anti-BOLA + estado).
  const [app] = await db.select({ id: scaleApplications.id, scaleType: scaleApplications.scaleType })
    .from(scaleApplications)
    .where(and(eq(scaleApplications.id, parsed.data.id), eq(scaleApplications.userId, p.userId), eq(scaleApplications.patientId, p.patientId), eq(scaleApplications.status, "pendente")))
    .limit(1);
  if (!app) return NextResponse.json({ ok: false, error: "Escala inválida ou já respondida." }, { status: 400 });

  const scale = SCALES[app.scaleType as ScaleType];
  if (!scale || parsed.data.answers.length !== scale.items.length) {
    return NextResponse.json({ ok: false, error: "Responda todas as perguntas." }, { status: 400 });
  }

  const score = parsed.data.answers.reduce((a, b) => a + b, 0);
  const severity = scale.severity(score).label;
  await db.update(scaleApplications)
    .set({ status: "respondida", answers: JSON.stringify(parsed.data.answers), score, severity, appliedAt: new Date() })
    .where(eq(scaleApplications.id, app.id));

  return NextResponse.json({ ok: true, score, severity });
}
