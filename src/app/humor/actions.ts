"use server";

import { db } from "@/db";
import { patients, moodLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Registro de humor pelo paciente via link mágico (sem auth).
export async function logMood(token: string, formData: FormData) {
  const patient = await db.query.patients.findFirst({ where: eq(patients.moodToken, token) });
  if (!patient) return { ok: false, error: "Link inválido." };

  const mood = parseInt(formData.get("mood") as string);
  if (!mood || mood < 1 || mood > 5) return { ok: false, error: "Escolha como está se sentindo." };

  await db.insert(moodLogs).values({
    userId: patient.userId,
    patientId: patient.id,
    mood,
    note: ((formData.get("note") as string) || "").trim() || null,
  });

  revalidatePath(`/dashboard/patients/${patient.id}`);
  return { ok: true };
}
