"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionPayments } from "@/db/schema";
import { auth } from "@/auth";

/**
 * Marca que o recibo (ou a nota) daquele pagamento foi emitido.
 *
 * O documento de 17/09 pede a indicação ao lado de "pago": *pago — emitido recibo* / *emitido nota*.
 * São dois carimbos independentes porque são dois documentos: quem emitiu a nota no Receita Saúde
 * pode não ter passado recibo, e vice-versa.
 *
 * Marcar é ato de registro, não de geração: o recibo é montado na hora de ver. Guardar o texto
 * gerado seria congelar dados que podem ser corrigidos depois (o nome de quem pagou, o CPF), e aí o
 * papel e o sistema passariam a discordar.
 */
export async function marcarEmissao(
  entrada: { pagamentoId: string; patientId: string; tipo: "recibo" | "nota" },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };

  const pagamentoId = String(entrada?.pagamentoId ?? "");
  const patientId = String(entrada?.patientId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pagamentoId)) return { ok: false, error: "Pagamento inválido." };

  const agora = new Date();
  // O `userId` na cláusula, e não só numa consulta anterior: é o que impede que um id de outro
  // consultório seja marcado por quem tiver o uuid.
  const { rowCount } = await db
    .update(sessionPayments)
    // A nota reaproveita `receiptIssuedAt`, a coluna que a tela do Receita Saúde já usa para dizer
    // o que falta emitir. Marcar aqui tira o pagamento da lista de pendentes de lá, que é o certo.
    .set(entrada.tipo === "nota" ? { receiptIssuedAt: agora } : { reciboEmitidoEm: agora })
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, session.user.id)))
    .then((r) => ({ rowCount: (r as unknown as { rowCount?: number }).rowCount ?? 1 }));

  if (!rowCount) return { ok: false, error: "Pagamento não encontrado." };

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}
