"use server";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, gte, lte, isNull, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type BankEntry = { id: string; date: string; amount: number; description: string };
export type Match = { entryId: string; entryDesc: string; entryDate: string; amount: number; txId: string; txDesc: string; txDate: string };

const day = 86400000;

// Cruza os lançamentos do extrato com as transações do sistema (não conciliadas).
// Match = mesmo sinal + mesmo valor (2 casas) + data dentro de ±3 dias.
export async function reconcileEntries(entries: BankEntry[]): Promise<{
  matches: Match[];
  unmatched: BankEntry[];
}> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  if (!entries?.length) return { matches: [], unmatched: [] };

  const dates = entries.map((e) => new Date(e.date).getTime()).filter((n) => !isNaN(n));
  const min = new Date(Math.min(...dates) - 4 * day);
  const max = new Date(Math.max(...dates) + 4 * day);

  const txs = await db.query.transactions.findMany({
    where: and(eq(transactions.userId, userId), isNull(transactions.reconciledAt), gte(transactions.date, min), lte(transactions.date, max)),
  });

  const used = new Set<string>();
  const matches: Match[] = [];
  const unmatched: BankEntry[] = [];

  for (const e of entries) {
    const et = new Date(e.date).getTime();
    const isIncome = e.amount >= 0;
    const val = Math.abs(e.amount).toFixed(2);
    const found = txs.find((t) => {
      if (used.has(t.id)) return false;
      if ((t.type === "income") !== isIncome) return false;
      if (parseFloat(t.amount).toFixed(2) !== val) return false;
      return Math.abs(new Date(t.date).getTime() - et) <= 3 * day;
    });
    if (found) {
      used.add(found.id);
      matches.push({
        entryId: e.id, entryDesc: e.description, entryDate: e.date, amount: e.amount,
        txId: found.id, txDesc: found.description || "(sem descrição)", txDate: (found.date as Date).toISOString(),
      });
    } else {
      unmatched.push(e);
    }
  }

  return { matches, unmatched };
}

// Marca as transações como conciliadas (aceitas).
export async function acceptReconciliation(txIds: string[]): Promise<{ ok: boolean; count: number }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  if (!txIds?.length) return { ok: true, count: 0 };
  await db.update(transactions)
    .set({ reconciledAt: new Date() })
    .where(and(eq(transactions.userId, session.user.id), inArray(transactions.id, txIds)));
  revalidatePath("/dashboard/transactions");
  return { ok: true, count: txIds.length };
}

// Qualifica um lançamento do extrato que NÃO conciliou: cria a transação e já marca conciliada.
export async function createFromBankEntry(entry: BankEntry, categoryId: string | null, method: string | null): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  await db.insert(transactions).values({
    userId,
    amount: Math.abs(entry.amount).toFixed(2),
    type: entry.amount >= 0 ? "income" : "expense",
    categoryId: categoryId || null,
    description: entry.description || "Importado do extrato",
    date: new Date(entry.date),
    source: "manual",
    method: method || null,
    reconciledAt: new Date(),
  });
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}
