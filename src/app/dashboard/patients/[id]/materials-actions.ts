"use server";

import { db } from "@/db";
import { patientDocument, patients } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

async function owns(userId: string, patientId: string) {
  const [p] = await db.select({ id: patients.id }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, userId))).limit(1);
  return !!p;
}

export async function shareMaterial(patientId: string, title: string, kind: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!(await owns(s.user.id, patientId))) return { ok: false, error: "Sem acesso a este paciente." };
  const t = title.trim(), c = content.trim();
  if (!t || !c) return { ok: false, error: "Preencha título e conteúdo." };
  await db.insert(patientDocument).values({ userId: s.user.id, patientId, title: t.slice(0, 160), kind: kind === "link" ? "link" : "text", content: c.slice(0, 8000) });
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

export async function listMaterials(patientId: string) {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db.select().from(patientDocument)
    .where(and(eq(patientDocument.userId, s.user.id), eq(patientDocument.patientId, patientId)))
    .orderBy(desc(patientDocument.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, content: r.content, at: (r.createdAt as Date).toISOString() }));
}

export async function deleteMaterial(id: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.delete(patientDocument).where(and(eq(patientDocument.id, id), eq(patientDocument.userId, s.user.id)));
  return { ok: true };
}
