import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { eq } from "drizzle-orm";

// Rate limit por janela fixa, persistido no banco (funciona em serverless).
// Retorna true se permitido; false se estourou o limite na janela.
export async function rateLimit(userId: string, route: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `${userId}:${route}`;
  const now = new Date();
  try {
    const row = await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, key) });
    if (!row) {
      await db.insert(rateLimits).values({ key, count: 1, windowStart: now }).onConflictDoNothing();
      return true;
    }
    const elapsed = (now.getTime() - new Date(row.windowStart).getTime()) / 1000;
    if (elapsed >= windowSec) {
      await db.update(rateLimits).set({ count: 1, windowStart: now }).where(eq(rateLimits.key, key));
      return true;
    }
    if (row.count >= limit) return false;
    await db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key));
    return true;
  } catch {
    return true; // fail-open: nunca bloquear por erro de infra
  }
}
