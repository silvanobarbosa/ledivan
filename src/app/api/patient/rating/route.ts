import { NextResponse } from "next/server";
import { and, eq, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessionRatings, therapySessions, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(userId: string, patientId: string) {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return resolveFeature(prefs.features?.rating, parseOverrides(pat?.ov).rating);
}

// GET /api/patient/rating — última sessão realizada ainda não avaliada (ou null).
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const [pending] = await db.select({ id: therapySessions.id, date: therapySessions.date })
    .from(therapySessions)
    .leftJoin(sessionRatings, eq(sessionRatings.sessionId, therapySessions.id))
    .where(and(
      eq(therapySessions.userId, p.userId),
      eq(therapySessions.patientId, p.patientId),
      eq(therapySessions.status, "realizada"),
      isNull(sessionRatings.id),
    ))
    .orderBy(desc(therapySessions.date))
    .limit(1);

  return NextResponse.json({ ok: true, pending: pending ?? null });
}

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// POST /api/patient/rating { sessionId, score, comment? } — avalia uma sessão realizada.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });

  // A sessão tem que ser deste paciente e estar realizada (BOLA/validação de estado).
  const [sess] = await db.select({ id: therapySessions.id })
    .from(therapySessions)
    .where(and(
      eq(therapySessions.id, parsed.data.sessionId),
      eq(therapySessions.userId, p.userId),
      eq(therapySessions.patientId, p.patientId),
      eq(therapySessions.status, "realizada"),
    ))
    .limit(1);
  if (!sess) return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 400 });

  try {
    await db.insert(sessionRatings).values({
      userId: p.userId, patientId: p.patientId, sessionId: sess.id,
      score: parsed.data.score, comment: parsed.data.comment ?? null,
    });
  } catch {
    // unique(sessionId) — já avaliada. Idempotente do ponto de vista do paciente.
    return NextResponse.json({ ok: true, already: true });
  }
  return NextResponse.json({ ok: true });
}
