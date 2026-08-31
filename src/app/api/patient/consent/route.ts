import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { consentForms, patientConsents, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(userId: string, patientId: string) {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return resolveFeature(prefs.features?.consent, parseOverrides(pat?.ov).consent);
}

// GET /api/patient/consent — termo atual + status de aceite (needed se ainda não aceitou a versão vigente).
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const [form] = await db.select().from(consentForms).where(eq(consentForms.userId, p.userId)).limit(1);
  if (!form) return NextResponse.json({ ok: true, form: null, needed: false, accepted: null });

  const [accepted] = await db.select({ acceptedName: patientConsents.acceptedName, acceptedAt: patientConsents.acceptedAt, formUpdatedAt: patientConsents.formUpdatedAt })
    .from(patientConsents)
    .where(and(eq(patientConsents.userId, p.userId), eq(patientConsents.patientId, p.patientId)))
    .orderBy(desc(patientConsents.acceptedAt))
    .limit(1);

  const needed = !accepted || new Date(accepted.formUpdatedAt).getTime() < new Date(form.updatedAt).getTime();
  return NextResponse.json({
    ok: true,
    form: { title: form.title, body: form.body, updatedAt: form.updatedAt },
    needed,
    accepted: accepted ? { name: accepted.acceptedName, at: accepted.acceptedAt } : null,
  });
}

const bodySchema = z.object({ name: z.string().trim().min(2).max(120) });

// POST /api/patient/consent { name } — paciente assina o termo vigente (snapshot + carimbo).
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gate(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Digite seu nome completo." }, { status: 400 });

  const [form] = await db.select().from(consentForms).where(eq(consentForms.userId, p.userId)).limit(1);
  if (!form) return NextResponse.json({ ok: false, error: "Nenhum termo disponível." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await db.insert(patientConsents).values({
    userId: p.userId, patientId: p.patientId,
    title: form.title, body: form.body, // snapshot da versão aceita
    acceptedName: parsed.data.name, formUpdatedAt: form.updatedAt, ip,
  });
  return NextResponse.json({ ok: true });
}
