import "server-only";

import { db } from "@/db";
import { cardFeeRates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPreferences } from "@/lib/preferences";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

/**
 * As vigências de taxa de cartão de um terapeuta, mais recente por último (ordem não importa para o
 * cálculo — `taxaVigenteEm` escolhe por data). Fonte da verdade = tabela `card_fee_rates` (doc 49).
 *
 * Compatibilidade: enquanto o terapeuta não cadastrou nenhuma vigência, caímos no `preferences.cardFees`
 * do doc 46/47 (se existir), tratado como uma vigência desde sempre — assim a taxa que ele já tinha
 * configurado continua valendo até ele registrar a primeira vigência com data.
 */
export async function getVigenciasTaxa(userId: string): Promise<VigenciaTaxa[]> {
  const rows = await db
    .select({ debito: cardFeeRates.debito, credito: cardFeeRates.credito, credito2x: cardFeeRates.credito2x, credito3x: cardFeeRates.credito3x, validFrom: cardFeeRates.validFrom })
    .from(cardFeeRates)
    .where(eq(cardFeeRates.userId, userId));

  if (rows.length > 0) {
    return rows.map((r) => ({
      validFrom: r.validFrom.toISOString(),
      debito: Number(r.debito) || 0,
      credito: Number(r.credito) || 0,
      credito2x: r.credito2x != null ? Number(r.credito2x) : null,
      credito3x: r.credito3x != null ? Number(r.credito3x) : null,
    }));
  }

  const legado = (await getPreferences(userId)).cardFees;
  if (legado && ((legado.debito ?? 0) > 0 || (legado.credito ?? 0) > 0)) {
    return [{ validFrom: "1970-01-01T00:00:00.000Z", debito: legado.debito ?? 0, credito: legado.credito ?? 0 }];
  }
  return [];
}
