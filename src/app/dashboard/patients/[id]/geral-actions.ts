"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { cobrancaEnvios, financialAccounts, patients, sessionPayments, transactions } from "@/db/schema";
import { ensureSessionCategory } from "@/lib/categoriaSessoes";
import { geralDoPaciente, hojeDeParede } from "@/lib/geralDoPaciente";
import { diaDoFormulario } from "@/lib/trocaDeFormato";
import { apenasCpf } from "@/lib/recibo";

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
  pagoPorCpf?: string | null;
  metodo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const metodo = String(entrada?.metodo ?? "");
  const pagoPor = String(entrada?.pagoPor ?? "").trim().slice(0, 120);
  // CPF é opcional por decisão do dono: quem paga nem sempre quer informar, e o recibo sai sem a
  // linha quando ele falta. Guardado só em dígitos (`apenasCpf`); a pontuação entra na hora de imprimir.
  const pagoPorCpf = apenasCpf(entrada?.pagoPorCpf);
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
    pagoPorCpf,
    pagoPor,
    cobrancaChave: chave,
    linkedTransactionId: tx.id,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/fechamento");
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}

/**
 * DESFAZ um pagamento lancado.
 *
 * A dona pediu o par completo (18/09): *"ao remover essa data, o pagamento volta para Em aberto ou
 * Atrasado, conforme a data de vencimento"*. Sem isso, um lancamento errado ficava para sempre.
 *
 * Apaga tambem a transacao vinculada. Pagamento e transacao sao o MESMO fato contado em duas telas;
 * deixar a transacao para tras faria a guia Geral dizer "em aberto" enquanto o caixa segue com o
 * dinheiro — foi por esse caminho que o financeiro ja divergiu antes.
 *
 * O `userId` vai nas duas clausulas: id de pagamento de outro consultorio responde "nao encontrado"
 * em vez de apagar.
 */
export async function removerPagamento(
  entrada: { pagamentoId: string; patientId: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const pagamentoId = String(entrada?.pagamentoId ?? "");
  const patientId = String(entrada?.patientId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pagamentoId)) return { ok: false, error: "Pagamento inválido." };

  const [pagamento] = await db
    .select({ id: sessionPayments.id, linkedTransactionId: sessionPayments.linkedTransactionId })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, patientId)))
    .limit(1);
  if (!pagamento) return { ok: false, error: "Pagamento não encontrado." };

  if (pagamento.linkedTransactionId) {
    await db.delete(transactions)
      .where(and(eq(transactions.id, pagamento.linkedTransactionId), eq(transactions.userId, userId)));
  }
  await db.delete(sessionPayments)
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, userId)));

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
 * Nao envia nada: registra o FATO de que a terapeuta avisou o paciente daquela cobranca, com o
 * instante e quem avisou.
 *
 * CADA CHAMADA E UMA LINHA. Antes havia um indice unico por (usuario, paciente, cobranca) e o
 * segundo aviso SUBSTITUIA a data do primeiro — o documento de 17/09 pede o contrario: "manter o
 * historico de todos os envios, sem substituir os registros anteriores". Quem cobrou tres vezes
 * precisa ver as tres datas, senao nao da para saber se o paciente esta sendo lembrado ou ignorado.
 */
export async function registrarCobrancaEnviada(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const session = await auth();
  // O INSTANTE, nao o dia ao meio-dia: o documento pede a hora junto da data, e dois avisos no
  // mesmo dia tem de ser distinguiveis. Gravado como hora de parede (ver horaLocal.ts).
  const agora = new Date();
  const enviadaEm = new Date(Date.UTC(
    agora.getFullYear(), agora.getMonth(), agora.getDate(),
    agora.getHours(), agora.getMinutes(), agora.getSeconds(),
  ));

  await db.insert(cobrancaEnvios)
    .values({ userId: ctx.userId, patientId, cobrancaChave: chave, enviadaEm, enviadaPor: session?.user?.name ?? null });

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/** Apaga TODOS os avisos daquela cobranca (registrei por engano). */
export async function limparEnviosDaCobranca(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
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
