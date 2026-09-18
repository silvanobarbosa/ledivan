"use server";

import { db } from "@/db";
import { sessionPayments, patients, transactions, financialAccounts } from "@/db/schema";
import { ensureSessionCategory } from "@/lib/categoriaSessoes";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoedaBR } from "@/lib/money";

type PaymentMethod = "pix" | "card" | "transfer" | "cash";
type PaymentStatus = "paid" | "pending" | "overdue";

export async function createPayment(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paciente obrigatório");

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const amount = parseMoedaBR(formData.get("amount"));
  if (!amount) throw new Error("Valor obrigatório");

  const dateRaw = formData.get("date") as string;
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const method = ((formData.get("method") as string) || "pix") as PaymentMethod;
  const status = ((formData.get("status") as string) || "paid") as PaymentStatus;
  const sessionId = (formData.get("sessionId") as string) || null;

  const kind = (formData.get("kind") as string) || null; // "pacote" = crédito de pacote (NÃO é receita)
  let linkedTransactionId: string | null = null;

  // Unificado: todo pagamento PAGO (que não seja crédito de pacote) SEMPRE reflete no caixa/relatórios.
  // Sem toggle — antes, com autoLinkPayments off, o pagamento sumia do caixa (divergência).
  if (status === "paid" && kind !== "pacote") {
    const categoryId = await ensureSessionCategory(userId);
    const account = await db.query.financialAccounts.findFirst({
      where: eq(financialAccounts.userId, userId),
    });

    const [tx] = await db.insert(transactions).values({
      userId,
      accountId: account?.id ?? null,
      amount,
      type: "income",
      categoryId,
      description: `Sessão — ${patient.name}`,
      date,
      source: "session_payment",
    }).returning();
    linkedTransactionId = tx.id;
  }

  await db.insert(sessionPayments).values({
    userId,
    patientId,
    sessionId,
    amount,
    date,
    method,
    status,
    kind,
    linkedTransactionId,
    packageId: (formData.get("packageId") as string) || null, // vínculo opcional com pacote
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  redirect(`/dashboard/patients/${patientId}`);
}

