import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patientWriting } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/writing/:id/share { shared: boolean } — o paciente decide (agora ou depois)
// se compartilha aquela escrita com o terapeuta.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;

  let b: { shared?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const shared = b.shared === true;

  // só a própria escrita do paciente
  const [row] = await db.select({ id: patientWriting.id }).from(patientWriting)
    .where(and(eq(patientWriting.id, id), eq(patientWriting.patientId, p.patientId))).limit(1);
  if (!row) return NextResponse.json({ ok: false, error: "Escrita não encontrada." }, { status: 404 });

  await db.update(patientWriting).set({ shared, sharedAt: shared ? new Date() : null }).where(eq(patientWriting.id, id));
  return NextResponse.json({ ok: true, shared });
}
