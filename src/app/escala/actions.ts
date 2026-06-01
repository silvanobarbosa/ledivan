"use server";

import { db } from "@/db";
import { scaleApplications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { SCALES, type ScaleType } from "@/lib/scales";

// Resposta da escala pelo paciente (sem auth). Auto-pontua e interpreta.
export async function submitScale(token: string, answers: number[]) {
  const app = await db.query.scaleApplications.findFirst({ where: eq(scaleApplications.token, token) });
  if (!app) return { ok: false, error: "Link inválido." };
  if (app.status === "respondida") return { ok: false, error: "Esta escala já foi respondida." };

  const scale = SCALES[app.scaleType as ScaleType];
  if (!scale) return { ok: false, error: "Escala inválida." };
  if (!Array.isArray(answers) || answers.length !== scale.items.length || answers.some((a) => a == null || a < 0 || a > 3)) {
    return { ok: false, error: "Responda todas as perguntas." };
  }

  const score = answers.reduce((a, b) => a + b, 0);
  const severity = scale.severity(score).label;

  await db.update(scaleApplications)
    .set({ status: "respondida", answers: JSON.stringify(answers), score, severity, appliedAt: new Date() })
    .where(eq(scaleApplications.id, app.id));

  revalidatePath(`/dashboard/patients/${app.patientId}`);
  return { ok: true, score, severity };
}
