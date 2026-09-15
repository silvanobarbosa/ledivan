import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";

const SESSION_CATEGORY = "Sessões";

// Garante a categoria de receita "Sessões" (usada nas transacoes geradas de pagamentos).
// Reusa a categoria PADRÃO global (userId NULL) ou a do próprio terapeuta; se não houver, cria
// uma do terapeuta. Nunca usa a categoria de outro tenant.
//
// Mora fora de um arquivo "use server" de propósito: lá, toda função assíncrona exportada vira
// endpoint chamável pelo navegador — e esta recebe o `userId` como argumento.
export async function ensureSessionCategory(userId: string): Promise<string> {
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.name, SESSION_CATEGORY),
      eq(categories.type, "income"),
      or(isNull(categories.userId), eq(categories.userId, userId)),
    ),
  });
  if (existing) return existing.id;
  const [created] = await db.insert(categories).values({
    userId,
    name: SESSION_CATEGORY,
    type: "income",
    icon: "HeartHandshake",
    color: "#8b5cf6",
  }).returning();
  return created.id;
}
