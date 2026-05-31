"use server";

import { db } from "@/db";
import { therapySessions, patients } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada";

export async function createSession(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paciente obrigatório");

  // valida posse do paciente
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const dateRaw = formData.get("date") as string;
  const fee = (formData.get("fee") as string)?.replace(",", ".") || patient.sessionFee;

  await db.insert(therapySessions).values({
    userId,
    patientId,
    date: dateRaw ? new Date(dateRaw) : new Date(),
    duration: formData.get("duration") ? parseInt(formData.get("duration") as string) : 50,
    fee,
    status: ((formData.get("status") as string) || "agendada") as SessionStatus,
    notes: (formData.get("notes") as string) || null,
    chargeable: formData.get("chargeable") !== "false",
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/agenda");
  redirect(`/dashboard/patients/${patientId}`);
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus, justificativa?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.update(therapySessions)
    .set({ status, justificativa: justificativa || null })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)));

  revalidatePath("/dashboard/agenda");
}

export async function deleteSession(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.delete(therapySessions)
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)));

  revalidatePath("/dashboard/agenda");
}
