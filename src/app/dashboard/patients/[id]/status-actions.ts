"use server";

import { and, eq, desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { patientDailyStatus, patients } from "@/db/schema";
import { auth } from "@/auth";
import { pushToPatient } from "@/lib/push";
import { revalidatePath } from "next/cache";

export type StatusRow = {
  id: string; emoji: string; mood: number | null; text: string | null; createdAt: string;
  reactionEmoji: string | null; reactionText: string | null; reactionAt: string | null;
};

// Carrega o histórico de status do dia de um paciente (do terapeuta logado) e marca como visto.
export async function carregarStatus(patientId: string): Promise<StatusRow[]> {
  const s = await auth();
  if (!s?.user?.id) return [];
  const userId = s.user.id;

  // posse
  const [own] = await db.select({ id: patients.id }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, userId))).limit(1);
  if (!own) return [];

  const rows = await db.select().from(patientDailyStatus)
    .where(and(eq(patientDailyStatus.userId, userId), eq(patientDailyStatus.patientId, patientId)))
    .orderBy(desc(patientDailyStatus.createdAt)).limit(60);

  if (rows.some((r) => !r.seenByTherapistAt)) {
    await db.update(patientDailyStatus).set({ seenByTherapistAt: new Date() })
      .where(and(eq(patientDailyStatus.userId, userId), eq(patientDailyStatus.patientId, patientId), isNull(patientDailyStatus.seenByTherapistAt))).catch(() => {});
  }

  return rows.map((r) => ({
    id: r.id, emoji: r.emoji, mood: r.mood, text: r.text, createdAt: r.createdAt.toISOString(),
    reactionEmoji: r.reactionEmoji, reactionText: r.reactionText, reactionAt: r.reactionAt ? r.reactionAt.toISOString() : null,
  }));
}

// Reage a um status; a reação volta ao paciente por push.
export async function reagirStatus(statusId: string, emoji: string, text?: string): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Não autorizado." };
  const e = (emoji || "").trim().slice(0, 16);
  if (!e) return { ok: false, error: "Escolha um emoji." };

  const [st] = await db.select({ id: patientDailyStatus.id, patientId: patientDailyStatus.patientId })
    .from(patientDailyStatus).where(and(eq(patientDailyStatus.id, statusId), eq(patientDailyStatus.userId, s.user.id))).limit(1);
  if (!st) return { ok: false, error: "Status não encontrado." };

  await db.update(patientDailyStatus).set({ reactionEmoji: e, reactionText: (text || "").trim().slice(0, 500) || null, reactionAt: new Date() })
    .where(eq(patientDailyStatus.id, statusId));
  await pushToPatient(st.patientId, "Seu terapeuta viu seu status 💚", `${e}${text ? " " + text.trim() : ""}`, { type: "status_reaction" });
  revalidatePath(`/dashboard/patients/${st.patientId}`);
  return { ok: true };
}
