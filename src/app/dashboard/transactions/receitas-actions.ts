"use server";

import { db } from "@/db";
import { receitasPessoais } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseMoedaBR } from "@/lib/money";
import { datasRecorrentes } from "@/lib/recorrencia";

const dataLocal = (iso: string) => new Date(`${iso}T12:00:00`);

function revalidar() {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard");
}

/** Cadastra uma receita pessoal (doc 50). "Repetir todo mês" cria uma por mês. */
export async function criarReceita(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const nome = ((formData.get("nome") as string) || "").trim();
  if (!nome) throw new Error("Nome da receita obrigatório");
  const valor = parseMoedaBR(formData.get("valor"));
  if (!valor) throw new Error("Valor obrigatório");
  const recISO = (formData.get("recebimento") as string) || new Date().toISOString().slice(0, 10);
  const jaRecebido = formData.get("recebido") === "on";

  const repetir = formData.get("repetir") === "on";
  const mesesRaw = Number(formData.get("meses"));
  const meses = repetir && Number.isFinite(mesesRaw) ? Math.min(60, Math.max(2, Math.floor(mesesRaw))) : 1;
  const datas = datasRecorrentes(recISO, meses);

  await db.insert(receitasPessoais).values(
    datas.map((d, i) => ({
      userId, nome, valor,
      recebimento: dataLocal(d),
      recebido: i === 0 ? jaRecebido : false, // só a 1ª pode já estar recebida; as futuras são previstas
    })),
  );
  revalidar();
}

/** Edita valor, data de recebimento e/ou o marcador "recebido" de uma receita. */
export async function editarReceita(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  if (!id) throw new Error("Receita inválida");

  const patch: { recebimento?: Date; valor?: string; recebido?: boolean } = {};
  const rec = formData.get("recebimento") as string;
  if (rec) patch.recebimento = dataLocal(rec);
  const valorRaw = formData.get("valor");
  if (valorRaw != null && String(valorRaw).trim() !== "") { const v = parseMoedaBR(valorRaw); if (v) patch.valor = v; }
  if (formData.has("recebido")) patch.recebido = formData.get("recebido") === "on";

  if (Object.keys(patch).length) {
    await db.update(receitasPessoais).set(patch).where(and(eq(receitasPessoais.id, id), eq(receitasPessoais.userId, session.user.id)));
  }
  revalidar();
}

/** Marca/desmarca uma receita como recebida (chip na linha). */
export async function marcarReceitaRecebida(id: string, recebido: boolean) {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.update(receitasPessoais).set({ recebido }).where(and(eq(receitasPessoais.id, id), eq(receitasPessoais.userId, session.user.id)));
  revalidar();
}

/** Exclui uma receita (lixeira). */
export async function excluirReceita(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await db.delete(receitasPessoais).where(and(eq(receitasPessoais.id, id), eq(receitasPessoais.userId, session.user.id)));
  revalidar();
}
