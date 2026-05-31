"use server";

import { db } from "@/db";
import { patients, patientStatusHistory, patientPriceHistory } from "@/db/schema";
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

export async function deletePatient(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.delete(patients).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/patients");
  redirect("/dashboard/patients");
}
