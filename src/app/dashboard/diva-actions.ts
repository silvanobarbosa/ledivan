"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { patientRecords, patients, therapySessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { agoraParede } from "@/lib/horaLocal";

/**
 * O QUE A VOZ EXECUTA — e só depois de ela confirmar na tela.
 *
 * Duas ações, e as duas recebem IDS, nunca texto. A fala já foi lida, o paciente já foi resolvido
 * contra a lista dela e a sessão já foi escolhida — tudo isso aconteceu ANTES, na prévia, e passou
 * pela vista dela. Aqui não se interpreta nada: se chegasse um nome para resolver, haveria um
 * segundo lugar decidindo quem é o paciente, e dois lugares decidindo é um lugar a mais para
 * errar.
 *
 * Reservar não está aqui de propósito: a voz PREENCHE a janela de Novo atendimento e a terapeuta
 * aperta Agendar. Criar sessão por voz pularia as perguntas de sequência do pacote e modalidade,
 * que têm consequência em dinheiro.
 */

/** A anotação ditada. Aditiva, sem dinheiro, e desfazível apagando o registro. */
export async function anotarPorVoz(patientId: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const conteudo = (texto ?? "").trim();
  if (!conteudo) return { ok: false, error: "Não entendi o que anotar." };

  // O paciente tem de ser DELA. O id veio da tela, e tela é conveniência, não fronteira.
  const paciente = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!paciente) return { ok: false, error: "Paciente não encontrado." };

  await db.insert(patientRecords).values({
    userId,
    patientId,
    type: "evolucao",
    // O título diz de onde veio: quem reler o prontuário daqui a um ano precisa saber que foi ditado.
    title: "Anotação por voz",
    content: conteudo,
    createdAt: agoraParede(),
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/**
 * O cancelamento ditado.
 *
 * Recebe o id da SESSÃO, nunca "a de amanhã": qual sessão é foi decidido na prévia e mostrado a
 * ela por extenso — paciente, dia e hora — antes do toque. Desmarcar a pessoa errada é o pior que
 * esta voz pode fazer, e é por isso que ela não escolhe aqui.
 */
export async function cancelarPorVoz(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { ok: false, error: "Atendimento não encontrado." };
  if (atual.status === "cancelada") return { ok: false, error: "Esse atendimento já está cancelado." };

  await db.update(therapySessions)
    .set({ status: "cancelada" })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)));

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);
  return { ok: true };
}
