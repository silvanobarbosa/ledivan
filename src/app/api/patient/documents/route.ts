import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { patientDocument } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/documents — materiais que o terapeuta compartilhou com o paciente.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const rows = await db.select({ id: patientDocument.id, title: patientDocument.title, kind: patientDocument.kind, content: patientDocument.content, createdAt: patientDocument.createdAt })
    .from(patientDocument)
    // Só o que foi COMPARTILHADO. Anexo do prontuário (laudo, relatório, encaminhamento) é do
    // lado do terapeuta e não pode vazar para o aplicativo do paciente por esta rota.
    .where(and(
      eq(patientDocument.userId, p.userId),
      eq(patientDocument.patientId, p.patientId),
      eq(patientDocument.compartilhado, true),
    ))
    .orderBy(desc(patientDocument.createdAt)).limit(100);
  return NextResponse.json({
    documents: rows.map((d) => ({ id: d.id, title: d.title, kind: d.kind, content: d.content, at: (d.createdAt as Date).toISOString() })),
  });
}
