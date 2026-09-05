import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { patientWriting, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gated(userId: string, patientId: string): Promise<boolean> {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ ov: patients.featureOverrides }).from(patients).where(eq(patients.id, patientId)).limit(1);
  return resolveFeature(prefs.features?.escritaTerapeutica, parseOverrides(pat?.ov).escritaTerapeutica);
}

// POST /api/patient/writing { promptKey?, promptTitle?, content, shared? } — grava uma escrita.
// PRIVADA por padrão; só compartilha com o terapeuta se shared=true.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await gated(p.userId, p.patientId))) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  let b: { promptKey?: string; promptTitle?: string; content?: string; shared?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const content = (b.content || "").trim();
  if (!content) return NextResponse.json({ ok: false, error: "Escreva algo antes de salvar." }, { status: 400 });
  const shared = b.shared === true;

  const [row] = await db.insert(patientWriting).values({
    userId: p.userId, patientId: p.patientId,
    promptKey: (b.promptKey || "").slice(0, 60) || null,
    promptTitle: (b.promptTitle || "").slice(0, 200) || null,
    content: content.slice(0, 20000),
    shared, sharedAt: shared ? new Date() : null,
  }).returning({ id: patientWriting.id });

  return NextResponse.json({ ok: true, id: row.id });
}

// GET /api/patient/writing — as escritas do próprio paciente (privadas + compartilhadas).
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const rows = await db.select().from(patientWriting)
    .where(and(eq(patientWriting.userId, p.userId), eq(patientWriting.patientId, p.patientId)))
    .orderBy(desc(patientWriting.createdAt)).limit(100);
  return NextResponse.json({ enabled: await gated(p.userId, p.patientId), writings: rows });
}
