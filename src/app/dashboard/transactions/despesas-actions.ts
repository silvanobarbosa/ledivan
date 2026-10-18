"use server";

import { db } from "@/db";
import { despesas } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseMoedaBR } from "@/lib/money";
import { datasRecorrentes } from "@/lib/recorrencia";

const dataLocal = (iso: string) => new Date(`${iso}T12:00:00`); // meio-dia local: não vira o dia em fuso

function revalidar() {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

/** Cadastra uma despesa (doc 50). "Repetir todo mês" cria uma linha por mês, cada uma com seu vencimento. */
export async function criarDespesa(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const nome = ((formData.get("nome") as string) || "").trim();
  if (!nome) throw new Error("Nome da despesa obrigatório");
  const valor = parseMoedaBR(formData.get("valor"));
  if (!valor) throw new Error("Valor obrigatório");
  const vencISO = (formData.get("vencimento") as string) || new Date().toISOString().slice(0, 10);
  const pagISO = (formData.get("pagamentoData") as string) || "";

  const repetir = formData.get("repetir") === "on";
  const mesesRaw = Number(formData.get("meses"));
  const meses = repetir && Number.isFinite(mesesRaw) ? Math.min(60, Math.max(2, Math.floor(mesesRaw))) : 1;
  const datas = datasRecorrentes(vencISO, meses);

  await db.insert(despesas).values(
    datas.map((d, i) => ({
      userId,
      nome,
      valor,
      vencimento: dataLocal(d),
      // Só a 1ª pode já nascer paga; as cópias futuras entram em aberto.
      pagamentoData: i === 0 && pagISO ? dataLocal(pagISO) : null,
    })),
  );
  revalidar();
}

/** Edita vencimento, valor e/ou data de pagamento de uma despesa (ícone de lápis). */
export async function editarDespesa(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  if (!id) throw new Error("Despesa inválida");

  const patch: { vencimento?: Date; valor?: string; pagamentoData?: Date | null } = {};
  const venc = formData.get("vencimento") as string;
  if (venc) patch.vencimento = dataLocal(venc);
  const valorRaw = formData.get("valor");
  if (valorRaw != null && String(valorRaw).trim() !== "") { const v = parseMoedaBR(valorRaw); if (v) patch.valor = v; }
  // pagamentoData: string vazia = marcar como NÃO paga (limpa).
  if (formData.has("pagamentoData")) { const p = (formData.get("pagamentoData") as string) || ""; patch.pagamentoData = p ? dataLocal(p) : null; }

  if (Object.keys(patch).length) {
    await db.update(despesas).set(patch).where(and(eq(despesas.id, id), eq(despesas.userId, session.user.id)));
  }
  revalidar();
}

/** Exclui uma despesa (ícone de lixeira). */
export async function excluirDespesa(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await db.delete(despesas).where(and(eq(despesas.id, id), eq(despesas.userId, session.user.id)));
  revalidar();
}
