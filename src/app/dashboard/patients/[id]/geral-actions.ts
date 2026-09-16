"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { cobrancaEnvios, financialAccounts, patients, sessionPayments, transactions } from "@/db/schema";
import { ensureSessionCategory } from "@/lib/categoriaSessoes";
import { geralDoPaciente, hojeDeParede } from "@/lib/geralDoPaciente";
import { diaDoFormulario } from "@/lib/trocaDeFormato";

/**
 * "Lançar pagamento" da guia Geral: data, responsável e forma. Mais nada vem do formulário.
 *
 * O VALOR é o que falta na cobrança, refeito aqui pelo mesmo motor da tela. Aceitar valor do
 * navegador deixaria qualquer um quitar R$ 520 com R$ 1. E a cobrança tem de existir para ESTE
 * paciente DESTE profissional — a chave é texto que qualquer um digita.
 */

const METODOS = new Set(["pix", "card", "cash", "transfer"]);

export async function lancarPagamento(entrada: {
  patientId: string;
  cobrancaChave: string;
  data: string;
  pagoPor: string;
  metodo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const metodo = String(entrada?.metodo ?? "");
  const pagoPor = String(entrada?.pagoPor ?? "").trim().slice(0, 120);
  const dia = diaDoFormulario(entrada?.data);

  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return { ok: false, error: "Paciente inválido." };
  if (!dia) return { ok: false, error: "Informe a data do pagamento." };
  if (!pagoPor) return { ok: false, error: "Informe quem pagou." };
  if (!METODOS.has(metodo)) return { ok: false, error: "Escolha a forma de pagamento." };

  const geral = await geralDoPaciente(userId, patientId);
  if (!geral) return { ok: false, error: "Paciente não encontrado." };

  const cobranca = geral.linhas
    .flatMap((l) => (l.tipo === "pagamento" ? [l] : l.cobranca ? [l.cobranca] : []))
    .find((c) => c.chave === chave);
  if (!cobranca) return { ok: false, error: "Cobrança não encontrada." };
  if (cobranca.situacao === "pago" || cobranca.falta <= 0) return { ok: false, error: "Esta cobrança já está paga." };

  const [paciente] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, patientId));
  const amount = cobranca.falta.toFixed(2);
  // Meio-dia: a coluna é hora de parede, e meio-dia não troca de dia em fuso nenhum do caminho.
  const date = new Date(`${entrada.data}T12:00:00`);

  // Todo pagamento PAGO entra no caixa — mesma regra do "Registrar pagamento".
  const categoryId = await ensureSessionCategory(userId);
  const account = await db.query.financialAccounts.findFirst({ where: eq(financialAccounts.userId, userId) });
  const [tx] = await db.insert(transactions).values({
    userId,
    accountId: account?.id ?? null,
    amount,
    type: "income",
    categoryId,
    description: `Sessão — ${paciente?.name ?? ""}`,
    date,
    source: "session_payment",
  }).returning();

  await db.insert(sessionPayments).values({
    userId,
    patientId,
    // Cobrança de UMA sessão: preenche o vínculo que a agenda usa para tirar o "pagamento atrasado".
    sessionId: /^(sessao|extra):[0-9a-f-]{36}$/i.test(chave) ? chave.split(":")[1] : null,
    amount,
    date,
    method: metodo as "pix" | "card" | "cash" | "transfer",
    status: "paid",
    pagoPor,
    cobrancaChave: chave,
    linkedTransactionId: tx.id,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/fechamento");
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}

/** Valida a dupla paciente+cobrança para as ações de envio. Devolve o userId ou um erro. */
async function contexto(patientId: string, chave: string): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão inválida." };
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return { error: "Paciente inválido." };
  const userId = session.user.id;

  const geral = await geralDoPaciente(userId, patientId);
  if (!geral) return { error: "Paciente não encontrado." };
  const existe = geral.linhas
    .flatMap((l) => (l.tipo === "pagamento" ? [l.chave] : l.cobranca ? [l.cobranca.chave] : []))
    .includes(chave);
  if (!existe) return { error: "Cobrança não encontrada." };
  return { userId };
}

/**
 * Marca uma cobrança como ENVIADA ao paciente — o "hoje ela só mostra" da guia Geral (dono, 13/09).
 *
 * Não envia nada: registra o FATO de que a terapeuta avisou o paciente daquela cobrança, com o dia e
 * quem marcou. Marcar de novo é reenvio: o índice único faz virar atualização da data, não linha nova.
 */
export async function marcarCobrancaEnviada(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const session = await auth();
  const h = hojeDeParede();
  // Dia SP ao meio-dia em UTC: a hora de parede fica nos campos UTC e o dia não escorrega no fuso.
  const enviadaEm = new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate(), 12));

  await db.insert(cobrancaEnvios)
    .values({ userId: ctx.userId, patientId, cobrancaChave: chave, enviadaEm, enviadaPor: session?.user?.name ?? null })
    .onConflictDoUpdate({
      target: [cobrancaEnvios.userId, cobrancaEnvios.patientId, cobrancaEnvios.cobrancaChave],
      set: { enviadaEm, enviadaPor: session?.user?.name ?? null },
    });

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/** Desfaz a marca de enviada (marquei por engano). */
export async function desmarcarCobrancaEnviada(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db.delete(cobrancaEnvios).where(
    and(eq(cobrancaEnvios.userId, ctx.userId), eq(cobrancaEnvios.patientId, patientId), eq(cobrancaEnvios.cobrancaChave, chave)),
  );

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}
