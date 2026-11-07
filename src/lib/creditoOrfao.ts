import "server-only";
import { and, eq, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { patientCredits, sessionPayments } from "@/db/schema";

/**
 * CRÉDITO SEM PAGAMENTO DE ORIGEM NÃO É DINHEIRO (doc 20).
 *
 * *"celani está constando um crédito no saldo de 60,00 mas isso não confere. Ela não tem nenhum
 * crédito"* — e não tinha mesmo: eram duas linhas (R$ 15 + R$ 45) nascidas de um pagamento que já
 * não existe.
 *
 * O caminho até lá tem duas pernas, e cada uma, sozinha, está certa:
 *
 * 1. apagar um pagamento apaga o crédito que ele GEROU **e ainda não foi usado**;
 * 2. apagar um pagamento devolve ao saldo o crédito que ele CONSUMIU.
 *
 * O buraco é a ordem. Um crédito já consumido não é apagado pela perna 1 — está preso a outro
 * pagamento. Quando esse outro é apagado depois, a perna 2 o devolve ao saldo sem perguntar se a
 * ORIGEM ainda existe. Volta como dinheiro que o paciente nunca pagou, disponível para abater uma
 * cobrança de verdade. `origem_pagamento_id` não tem chave estrangeira, então o banco também não
 * reclama.
 *
 * A varredura é por paciente e roda depois de cada remoção de pagamento: é barata e fecha o
 * buraco em qualquer ordem de cliques, inclusive na que já aconteceu em produção.
 */
export async function limparCreditosOrfaos(userId: string, patientId: string): Promise<number> {
  const abertos = await db
    .select({ id: patientCredits.id, origem: patientCredits.origemPagamentoId })
    .from(patientCredits)
    .where(and(
      eq(patientCredits.userId, userId),
      eq(patientCredits.patientId, patientId),
      isNull(patientCredits.consumidoEm),
      isNotNull(patientCredits.origemPagamentoId),
    ));
  if (!abertos.length) return 0;

  const origens = [...new Set(abertos.map((c) => c.origem).filter((o): o is string => !!o))];
  const vivos = new Set(
    (await db.select({ id: sessionPayments.id }).from(sessionPayments)
      .where(and(eq(sessionPayments.userId, userId), inArray(sessionPayments.id, origens)))).map((p) => p.id),
  );

  const orfaos = abertos.filter((c) => c.origem && !vivos.has(c.origem)).map((c) => c.id);
  if (!orfaos.length) return 0;
  await db.delete(patientCredits).where(and(eq(patientCredits.userId, userId), inArray(patientCredits.id, orfaos)));
  return orfaos.length;
}
