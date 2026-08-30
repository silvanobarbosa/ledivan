import { NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/tasks — tarefas (lição de casa) do paciente. Bearer do paciente.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rows = await db.select({
    id: assignments.id, title: assignments.title, instructions: assignments.instructions,
    responseType: assignments.responseType, status: assignments.status, dueDate: assignments.dueDate,
    respondedAt: assignments.respondedAt, therapistComment: assignments.therapistComment,
  })
    .from(assignments)
    .where(and(eq(assignments.userId, p.userId), eq(assignments.patientId, p.patientId)))
    .orderBy(desc(assignments.createdAt)).limit(50);

  return NextResponse.json({
    tasks: rows.map((r) => ({
      id: r.id, title: r.title, instructions: r.instructions, responseType: r.responseType,
      status: r.status, dueDate: r.dueDate ? (r.dueDate as Date).toISOString() : null,
      respondedAt: r.respondedAt ? (r.respondedAt as Date).toISOString() : null,
      therapistComment: r.therapistComment,
    })),
  });
}
