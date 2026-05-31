import { db } from "@/db";
import { achievements, transactions, goals } from "@/db/schema";
import { eq, count, sum, and } from "drizzle-orm";

export async function checkAchievements(userId: string) {
  const userAchievements = await db.query.achievements.findMany({
    where: eq(achievements.userId, userId),
  });

  const hasAchievement = (type: string) => userAchievements.some(a => a.type === type);

  // 1. Primeira Transação
  if (!hasAchievement("first_transaction")) {
    const [tCount] = await db.select({ val: count() }).from(transactions).where(eq(transactions.userId, userId));
    if (Number(tCount.val) >= 1) {
      await db.insert(achievements).values({
        userId,
        type: "first_transaction",
        title: "Primeiro Passo",
        description: "Você registrou sua primeira transação no Ledivan+!",
      });
      return true;
    }
  }

  // 2. Mestre do Planejamento (Atingir uma meta)
  if (!hasAchievement("goal_met")) {
    const userGoals = await db.query.goals.findMany({
      where: eq(goals.userId, userId),
    });
    const completedGoal = userGoals.find(g => parseFloat(g.currentAmount) >= parseFloat(g.targetAmount));
    if (completedGoal) {
      await db.insert(achievements).values({
        userId,
        type: "goal_met",
        title: "Mestre do Planejamento",
        description: `Você atingiu sua meta: ${completedGoal.title}!`,
      });
      return true;
    }
  }

  // 3. Scanner Ninja (3 Scans)
  if (!hasAchievement("scanner_ninja")) {
    const [sCount] = await db.select({ val: count() })
      .from(transactions)
      .where(and(eq(transactions.source, "scan"), eq(transactions.userId, userId)));
    if (Number(sCount.val) >= 3) {
      await db.insert(achievements).values({
        userId,
        type: "scanner_ninja",
        title: "Scanner Ninja",
        description: "Você processou 3 recibos usando o scan com IA!",
      });
      return true;
    }
  }

  // 4. Voice Wizard (Primeira transação via Telegram)
  if (!hasAchievement("voice_wizard")) {
    const [tCount] = await db.select({ val: count() })
      .from(transactions)
      .where(and(eq(transactions.source, "telegram"), eq(transactions.userId, userId)));
    if (Number(tCount.val) >= 1) {
      await db.insert(achievements).values({
        userId,
        type: "voice_wizard",
        title: "Mago da Voz",
        description: "Você registrou seu primeiro lançamento via Telegram!",
      });
      return true;
    }
  }

  // 5. Financial Guru (Tem conquista e meta)
  if (!hasAchievement("financial_guru")) {
    const [goalCount] = await db.select({ val: count() }).from(goals).where(eq(goals.userId, userId));
    if (Number(goalCount.val) >= 1 && userAchievements.length >= 2) {
      await db.insert(achievements).values({
        userId,
        type: "financial_guru",
        title: "Guru Financeiro",
        description: "Você está dominando o Ledivan+! Meta e conquistas em dia.",
      });
      return true;
    }
  }

  return false;
}
