"use server";

import { db } from "@/db";
import { sessionPayments, patients, transactions, categories, financialAccounts } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/preferences";

type PaymentMethod = "pix" | "card" | "transfer" | "cash";
type PaymentStatus = "paid" | "pending" | "overdue";

const SESSION_CATEGORY = "Sessões";

// Garante a categoria de receita "Sessões" (usada nas transacoes geradas de pagamentos)
async function ensureSessionCategory(): Promise<string> {
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.name, SESSION_CATEGORY), eq(categories.type, "income")),
  });
  if (existing) return existing.id;
  const [created] = await db.insert(categories).values({
    name: SESSION_CATEGORY,
    type: "income",
    icon: "HeartHandshake",
    color: "#8b5cf6",
  }).returning();
  return created.id;
}

export async function createPayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paciente obrigatório");

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const amount = (formData.get("amount") as string)?.replace(",", ".");
  if (!amount) throw new Error("Valor obrigatório");

  const dateRaw = formData.get("date") as string;
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const method = ((formData.get("method") as string) || "pix") as PaymentMethod;
  const status = ((formData.get("status") as string) || "paid") as PaymentStatus;
  const sessionId = (formData.get("sessionId") as string) || null;

  // Decide se vincula ao financeiro: toggle do form OU preferencia do terapeuta.
  // O form manda "link" = "on" | "off" | "" (vazio = usar preferencia).
  const linkField = formData.get("link") as string | null;
  const prefs = await getPreferences(userId);
  const shouldLink =
    linkField === "on" ? true : linkField === "off" ? false : !!prefs.autoLinkPayments;

  let linkedTransactionId: string | null = null;

  // Só vira receita se de fato foi pago.
  if (shouldLink && status === "paid") {
    const categoryId = await ensureSessionCategory();
    const account = await db.query.financialAccounts.findFirst({
      where: eq(financialAccounts.userId, userId),
    });

    const [tx] = await db.insert(transactions).values({
      userId,
      accountId: account?.id ?? null,
      amount,
      type: "income",
      categoryId,
      description: `Sessão — ${patient.name}`,
      date,
      source: "session_payment",
    }).returning();
    linkedTransactionId = tx.id;
  }

  await db.insert(sessionPayments).values({
    userId,
    patientId,
    sessionId,
    amount,
    date,
    method,
    status,
    linkedTransactionId,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/patients/${patientId}`);
}

export async function deletePayment(paymentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const payment = await db.query.sessionPayments.findFirst({
    where: and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, userId)),
  });
  if (!payment) return;

  // Remove tambem a transacao vinculada (se houver), mantendo financeiro consistente.
  if (payment.linkedTransactionId) {
    await db.delete(transactions).where(
      and(eq(transactions.id, payment.linkedTransactionId), eq(transactions.userId, userId))
    );
  }
  await db.delete(sessionPayments).where(and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, userId)));

  revalidatePath(`/dashboard/patients/${payment.patientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
}
