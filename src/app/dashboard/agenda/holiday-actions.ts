"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { HolidayCity } from "@/lib/holidays-style";

// Salva as cidades de feriado do usuário (até 3). Lista vazia = desativa.
export async function saveHolidayCities(cities: HolidayCity[]): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };

  const clean = (Array.isArray(cities) ? cities : [])
    .filter((c) => c && Number.isInteger(c.ibge) && typeof c.nome === "string" && c.nome.length > 0)
    .slice(0, 3)
    .map((c) => ({ ibge: c.ibge, nome: c.nome, uf: (c.uf || "").slice(0, 2) }));

  await db.update(users).set({ holidayCities: clean.length ? JSON.stringify(clean) : null }).where(eq(users.id, session.user.id));
  revalidatePath("/dashboard/agenda");
  return { ok: true };
}
