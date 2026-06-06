"use server";

import { db } from "@/db";
import { transactions, financialAccounts, sessionPayments } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

type TxType = "income" | "expense";

export async function createTransaction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const amount = (formData.get("amount") as string)?.replace(",", ".");
  if (!amount) throw new Error("Valor obrigatório");

  const type = ((formData.get("type") as string) || "expense") as TxType;
  const categoryId = (formData.get("categoryId") as string) || null;
  const accountId = (formData.get("accountId") as string) || null;
  const dateRaw = formData.get("date") as string;

  await db.insert(transactions).values({
    userId,
    amount,
    type,
    categoryId: categoryId || null,
    accountId: accountId || null,
    description: (formData.get("description") as string) || null,
    date: dateRaw ? new Date(dateRaw) : new Date(),
    source: "manual",
    method: (formData.get("method") as string) || null,
  });

  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(transactionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  // Se esta transação veio de um pagamento de sessão, desvincula o pagamento antes.
  await db.update(sessionPayments)
    .set({ linkedTransactionId: null })
    .where(and(eq(sessionPayments.linkedTransactionId, transactionId), eq(sessionPayments.userId, userId)));

  await db.delete(transactions).where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));

  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

// Helper p/ criar conta financeira rápida (usado se o terapeuta não tiver nenhuma)
export async function createFinancialAccount(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  await db.insert(financialAccounts).values({
    userId: session.user.id,
    name: name.trim(),
    type: (formData.get("type") as string) || "checking",
    balance: ((formData.get("balance") as string) || "0").replace(",", "."),
    color: "#8b5cf6",
  });

  revalidatePath("/dashboard/transactions");
}
