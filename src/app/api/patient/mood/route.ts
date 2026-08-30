import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { moodLogs, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/mood { mood: 1..5, note?, context? } — check-in de humor. Gated no recurso moodCheckin.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const prefs = await getPreferences(p.userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  if (!resolveFeature(prefs.features?.moodCheckin, parseOverrides(pat?.ov).moodCheckin)) {
    return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });
  }

  let b: { mood?: number; note?: string; context?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const mood = Number(b.mood);
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) return NextResponse.json({ ok: false, error: "Humor inválido." }, { status: 400 });
  const context = b.context === "pre" || b.context === "post" ? b.context : "free";

  await db.insert(moodLogs).values({ userId: p.userId, patientId: p.patientId, mood, note: (b.note || "").slice(0, 500) || null, context });
  return NextResponse.json({ ok: true });
}
