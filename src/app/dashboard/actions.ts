"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Salva o modelo da mensagem de aniversário no perfil do terapeuta.
 *
 * Devolve `{ ok }` em vez de lançar: quem chama é um botão dentro do painel, e derrubar a
 * árvore de React por causa de um texto que não salvou seria pior que mostrar o aviso.
 */
export async function salvarMensagemAniversario(texto: string): Promise<{ ok: boolean; erro?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, erro: "Não autorizado" };

  const limpo = (texto ?? "").trim().slice(0, 1000);
  try {
    await db.update(users).set({ birthdayMessage: limpo || null }).where(eq(users.id, session.user.id));
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, erro: "Falha ao salvar" };
  }
}
