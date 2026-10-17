"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { cardFeeRates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { normalizarTaxa } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export type VigenciaTaxaDTO = { id: string; debito: number; credito: number; validFrom: string };

/** Lista as vigências de taxa do terapeuta, mais recente primeiro. */
export async function listarVigenciasTaxa(): Promise<VigenciaTaxaDTO[]> {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db
    .select({ id: cardFeeRates.id, debito: cardFeeRates.debito, credito: cardFeeRates.credito, validFrom: cardFeeRates.validFrom })
    .from(cardFeeRates)
    .where(eq(cardFeeRates.userId, s.user.id))
    .orderBy(desc(cardFeeRates.validFrom));
  return rows.map((r) => ({ id: r.id, debito: Number(r.debito) || 0, credito: Number(r.credito) || 0, validFrom: r.validFrom.toISOString().slice(0, 10) }));
}

/**
 * Registra uma NOVA vigência de taxa (doc 49): preserva as anteriores e passa a valer a partir da
 * data escolhida. Nunca recalcula o passado. A data é definida pelo usuário.
 */
export async function adicionarVigenciaTaxa(cfg: { debito: unknown; credito: unknown; validFrom: string }): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.validFrom)) return { ok: false, error: "Informe a data de início da vigência." };
  const debito = normalizarTaxa(cfg.debito);
  const credito = normalizarTaxa(cfg.credito);
  await db.insert(cardFeeRates).values({
    userId: s.user.id,
    debito: debito.toFixed(2),
    credito: credito.toFixed(2),
    validFrom: new Date(`${cfg.validFrom}T12:00:00`),
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/pagamentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Remove uma vigência (correção de cadastro). Só a do próprio terapeuta. */
export async function removerVigenciaTaxa(id: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.delete(cardFeeRates).where(and(eq(cardFeeRates.id, id), eq(cardFeeRates.userId, s.user.id)));
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}
