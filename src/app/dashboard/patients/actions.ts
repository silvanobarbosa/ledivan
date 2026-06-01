"use server";

import { db } from "@/db";
import { patients, patientStatusHistory, patientPriceHistory, patientRecords, assignments } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function num(v: FormDataEntryValue | null, fallback = "0") {
  if (v == null || v === "") return fallback;
  return String(v).replace(",", ".");
}

export async function createPatient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  const startedAtRaw = formData.get("startedAt") as string;
  const sessionFee = num(formData.get("sessionFee"));

  const [created] = await db.insert(patients).values({
    userId,
    name: name.trim(),
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    sessionFee,
    frequency: (formData.get("frequency") as string) || null,
    notes: (formData.get("notes") as string) || null,
    patientStatus: (formData.get("patientStatus") as string) || "ativo",
    startedAt: startedAtRaw ? new Date(startedAtRaw) : new Date(),
    address: (formData.get("address") as string) || null,
    emergencyName: (formData.get("emergencyName") as string) || null,
    emergencyPhone: (formData.get("emergencyPhone") as string) || null,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) || null,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : null,
    contractType: ((formData.get("contractType") as string) || "avulso") as "pacote" | "avulso",
    sessionsInPacket: formData.get("sessionsInPacket")
      ? parseInt(formData.get("sessionsInPacket") as string)
      : null,
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderChannel: (formData.get("reminderChannel") as string) || "whatsapp",
  }).returning();

  // registra historico inicial
  await db.insert(patientStatusHistory).values({
    patientId: created.id,
    status: created.patientStatus,
  });
  await db.insert(patientPriceHistory).values({
    patientId: created.id,
    valor: sessionFee,
    dataEfetiva: created.startedAt ?? new Date(),
  });

  revalidatePath("/dashboard/patients");
  redirect(`/dashboard/patients/${created.id}`);
}

export async function updatePatient(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const existing = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, session.user.id)),
  });
  if (!existing) throw new Error("Paciente não encontrado");

  const newFee = num(formData.get("sessionFee"), existing.sessionFee);
  const newStatus = (formData.get("patientStatus") as string) || existing.patientStatus;

  await db.update(patients).set({
    name: (formData.get("name") as string) || existing.name,
    email: (formData.get("email") as string) ?? existing.email,
    phone: (formData.get("phone") as string) ?? existing.phone,
    sessionFee: newFee,
    frequency: (formData.get("frequency") as string) ?? existing.frequency,
    notes: (formData.get("notes") as string) ?? existing.notes,
    patientStatus: newStatus,
    address: (formData.get("address") as string) ?? existing.address,
    emergencyName: (formData.get("emergencyName") as string) ?? existing.emergencyName,
    emergencyPhone: (formData.get("emergencyPhone") as string) ?? existing.emergencyPhone,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) ?? existing.emergencyRelationship,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : existing.paymentDay,
    contractType: ((formData.get("contractType") as string) || existing.contractType) as "pacote" | "avulso",
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderChannel: (formData.get("reminderChannel") as string) || existing.reminderChannel,
  }).where(eq(patients.id, patientId));

  // historico de mudancas
  if (newStatus !== existing.patientStatus) {
    await db.insert(patientStatusHistory).values({ patientId, status: newStatus });
  }
  if (newFee !== existing.sessionFee) {
    await db.insert(patientPriceHistory).values({ patientId, valor: newFee, dataEfetiva: new Date() });
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients");
}

// --- Prontuário (registros clínicos) ---

export async function createRecord(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  // valida posse do paciente
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const content = (formData.get("content") as string)?.trim();
  if (!content) throw new Error("Conteúdo obrigatório");

  await db.insert(patientRecords).values({
    userId,
    patientId,
    type: (formData.get("type") as string) || "evolucao",
    title: (formData.get("title") as string) || null,
    content,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deleteRecord(recordId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const rec = await db.query.patientRecords.findFirst({
    where: and(eq(patientRecords.id, recordId), eq(patientRecords.userId, userId)),
  });
  if (!rec) return;
  await db.delete(patientRecords).where(eq(patientRecords.id, recordId));
  revalidatePath(`/dashboard/patients/${rec.patientId}`);
}

// Gera (se ainda não houver) o token do diário de humor do paciente.
export async function ensureMoodToken(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");
  if (!patient.moodToken) {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    await db.update(patients).set({ moodToken: token }).where(eq(patients.id, patientId));
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// --- Espaço do Paciente: tarefas (lição de casa) ---

export async function createAssignment(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Título obrigatório");

  const dueRaw = formData.get("dueDate") as string;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  await db.insert(assignments).values({
    userId,
    patientId,
    token,
    title,
    instructions: (formData.get("instructions") as string) || null,
    responseType: (formData.get("responseType") as string) || "texto",
    dueDate: dueRaw ? new Date(dueRaw) : null,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deleteAssignment(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const a = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)),
  });
  if (!a) return;
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  revalidatePath(`/dashboard/patients/${a.patientId}`);
}

export async function commentAssignment(assignmentId: string, comment: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const a = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)),
  });
  if (!a) return;
  await db.update(assignments).set({ therapistComment: comment }).where(eq(assignments.id, assignmentId));
  revalidatePath(`/dashboard/patients/${a.patientId}`);
}

export async function deletePatient(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.delete(patients).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/patients");
  redirect("/dashboard/patients");
}
