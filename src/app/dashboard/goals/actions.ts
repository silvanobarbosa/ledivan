"use server";

import { db } from "@/db";
import { goals } from "@/db/schema";
import { auth } from "@/auth";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createGoal(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const title = formData.get("title") as string;
  const targetAmount = formData.get("targetAmount") as string;
  const deadline = formData.get("deadline") as string;

  await db.insert(goals).values({
    userId: session.user.id,
    title,
    targetAmount: targetAmount.replace(",", "."),
    deadline: deadline ? new Date(deadline) : null,
  });

  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}

export async function addAmountToGoal(goalId: string, amount: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const numericAmount = parseFloat(amount.replace(",", "."));
  
  await db.update(goals)
    .set({
      currentAmount: sql`${goals.currentAmount} + ${numericAmount}`
    })
    .where(and(eq(goals.id, goalId), eq(goals.userId, session.user.id)));

  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}

export async function deleteGoal(goalId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, session.user.id)));

  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}
