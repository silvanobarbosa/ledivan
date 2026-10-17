"use server";

import { auth } from "@/auth";
import { setPreferences, getPreferences } from "@/lib/preferences";
import { normalizarTaxa, type CardFees } from "@/lib/finance";
import { revalidatePath } from "next/cache";

// Salva as taxas da maquininha (débito/crédito). Só o valor LÍQUIDO usa isso; o bruto não muda.
export async function saveTaxas(cfg: { debito: unknown; credito: unknown }): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const cardFees: CardFees = { debito: normalizarTaxa(cfg.debito), credito: normalizarTaxa(cfg.credito) };
  const prev = await getPreferences(s.user.id);
  await setPreferences(s.user.id, { ...prev, cardFees });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}
