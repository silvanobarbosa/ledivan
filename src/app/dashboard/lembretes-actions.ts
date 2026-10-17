"use server";

import { db } from "@/db";
import { auth } from "@/auth";
import { outboundReminders, patients } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const KINDS = new Set(["aniversario", "reajuste", "devolutiva"]);

/**
 * Registra UM lembrete enviado (doc 49): só é chamado quando o terapeuta CONFIRMA que enviou
 * (igual o "Cobrar" do Vencimentos por dia). Valida posse do cadastro antes de contar.
 */
export async function registrarLembrete(patientId: string, kind: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  if (!KINDS.has(kind)) return { ok: false };
  const dono = await db.query.patients.findFirst({ where: and(eq(patients.id, patientId), eq(patients.userId, s.user.id)) });
  if (!dono) return { ok: false };
  await db.insert(outboundReminders).values({ userId: s.user.id, patientId, kind });
  return { ok: true };
}

/** Contagem de lembretes por (patientId, kind) do terapeuta — para mostrar "(Nx)". Chave `${id}:${kind}`. */
export async function contarLembretes(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ patientId: outboundReminders.patientId, kind: outboundReminders.kind, n: sql<number>`count(*)::int` })
    .from(outboundReminders)
    .where(eq(outboundReminders.userId, userId))
    .groupBy(outboundReminders.patientId, outboundReminders.kind);
  const out: Record<string, number> = {};
  for (const r of rows) out[`${r.patientId}:${r.kind}`] = r.n;
  return out;
}
