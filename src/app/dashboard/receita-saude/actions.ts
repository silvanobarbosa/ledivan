"use server";

import { db } from "@/db";
import { sessionPayments } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Marca um pagamento como tendo recibo Receita Saúde emitido (nº opcional).
export async function markReceiptIssued(paymentId: string, receiptNumber: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const num = (receiptNumber || "").trim().slice(0, 60) || null;
  await db.update(sessionPayments)
    .set({ receiptNumber: num, receiptIssuedAt: new Date() })
    .where(and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, s.user.id)));
  revalidatePath("/dashboard/receita-saude");
  return { ok: true };
}

// Desfaz a marcação (voltou a pendente).
export async function clearReceipt(paymentId: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.update(sessionPayments)
    .set({ receiptNumber: null, receiptIssuedAt: null })
    .where(and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, s.user.id)));
  revalidatePath("/dashboard/receita-saude");
  return { ok: true };
}
