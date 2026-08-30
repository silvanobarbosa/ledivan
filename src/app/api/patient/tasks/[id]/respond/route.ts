import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assignments, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/tasks/:id/respond { text } — paciente responde a tarefa (texto). Avisa o terapeuta.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  let b: { text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const text = (b.text || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Resposta vazia." }, { status: 400 });

  const [a] = await db.select().from(assignments)
    .where(and(eq(assignments.id, id), eq(assignments.patientId, p.patientId), eq(assignments.userId, p.userId))).limit(1);
  if (!a) return NextResponse.json({ ok: false, error: "Tarefa não encontrada." }, { status: 404 });

  await db.update(assignments).set({ responseText: text.slice(0, 4000), status: "respondida", respondedAt: new Date() }).where(eq(assignments.id, id));
  const [pat] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  await pushToTherapist(p.userId, "Tarefa respondida ✅", `${pat?.name ?? "Paciente"} respondeu "${a.title}".`, { type: "task", id });
  return NextResponse.json({ ok: true });
}
