"use server";

import { db } from "@/db";
import { patients, patientStatusHistory } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProspect(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  const dateRaw = formData.get("prospectDate") as string;

  await db.insert(patients).values({
    userId,
    name: name.trim(),
    phone: (formData.get("phone") as string) || null,
    email: (formData.get("email") as string) || null,
    patientStatus: "prospect",
    prospectDate: dateRaw ? new Date(dateRaw) : new Date(),
    prospectFechou: (formData.get("prospectFechou") as string) || "",
    prospectObservacoes: (formData.get("prospectObservacoes") as string) || null,
    sessionFee: ((formData.get("sessionFee") as string) || "0").replace(",", "."),
  });

  revalidatePath("/dashboard/prospects");
  redirect("/dashboard/prospects");
}

// Converte prospect em paciente ativo
export async function convertProspect(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.update(patients)
    .set({ patientStatus: "ativo", prospectFechou: "Fechou", startedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  await db.insert(patientStatusHistory).values({ patientId, status: "ativo" });

  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard/patients");
  redirect(`/dashboard/patients/${patientId}`);
}

export async function updateProspectOutcome(patientId: string, fechou: string, observacoes?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.update(patients)
    .set({ prospectFechou: fechou, prospectObservacoes: observacoes || null })
    .where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/prospects");
}
