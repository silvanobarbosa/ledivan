import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  patients, therapySessions, patientRecords, sessionPayments, assignments,
  moodLogs, scaleApplications, treatmentGoals, patientDiary, sessionRatings, patientConsents,
} from "@/db/schema";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patients/<id>/export — portabilidade (LGPD art. 18, V).
// Baixa TODOS os dados do paciente em JSON. Só o terapeuta dono acessa.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await auth();
  if (!s?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const userId = s.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Inválido." }, { status: 400 });

  const [patient] = await db.select().from(patients)
    .where(and(eq(patients.id, id), eq(patients.userId, userId))).limit(1);
  if (!patient) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  const [sessoes, prontuario, pagamentos, tarefas, humor, escalas, metas, diario, avaliacoes, consentimentos] = await Promise.all([
    db.select().from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.patientId, id))),
    db.select().from(patientRecords).where(and(eq(patientRecords.userId, userId), eq(patientRecords.patientId, id))),
    db.select().from(sessionPayments).where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, id))),
    db.select().from(assignments).where(and(eq(assignments.userId, userId), eq(assignments.patientId, id))),
    db.select().from(moodLogs).where(eq(moodLogs.patientId, id)),
    db.select().from(scaleApplications).where(and(eq(scaleApplications.userId, userId), eq(scaleApplications.patientId, id))),
    db.select().from(treatmentGoals).where(and(eq(treatmentGoals.userId, userId), eq(treatmentGoals.patientId, id))),
    db.select().from(patientDiary).where(and(eq(patientDiary.userId, userId), eq(patientDiary.patientId, id))),
    db.select().from(sessionRatings).where(and(eq(sessionRatings.userId, userId), eq(sessionRatings.patientId, id))),
    db.select().from(patientConsents).where(and(eq(patientConsents.userId, userId), eq(patientConsents.patientId, id))),
  ]);

  const dump = {
    geradoEm: new Date().toISOString(),
    aviso: "Exportação de dados pessoais (LGPD art. 18). Contém dados sensíveis de saúde — guarde com cuidado.",
    paciente: patient,
    sessoes, prontuario, pagamentos, tarefas, humor, escalas, metas, diario, avaliacoes, consentimentos,
  };

  const nome = (patient.name || "paciente").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledivan-${nome}-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
