"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { patientRecords, patients, therapySessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { agoraParede } from "@/lib/horaLocal";
import { quandoDoRecibo, type ReciboDaVoz } from "@/lib/reciboDaVoz";

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
export async function anotarPorVoz(patientId: string, texto: string): Promise<{ ok: boolean; error?: string; recibo?: ReciboDaVoz }> {
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

  const [gravado] = await db.insert(patientRecords).values({
    userId,
    patientId,
    type: "evolucao",
    // O título diz de onde veio: quem reler o prontuário daqui a um ano precisa saber que foi ditado.
    title: "Anotação por voz",
    content: conteudo,
    createdAt: agoraParede(),
  }).returning({ id: patientRecords.id, content: patientRecords.content, createdAt: patientRecords.createdAt });

  revalidatePath(`/dashboard/patients/${patientId}`);
  // O recibo sai do que o banco devolveu, não do que mandamos gravar.
  if (!gravado) return { ok: false, error: "A anotação não foi gravada. Tente de novo." };
  return {
    ok: true,
    recibo: {
      comando: "anotar no prontuário",
      paciente: paciente.name,
      gravado: `Anotação por voz: “${gravado.content}”`,
      quando: quandoDoRecibo(gravado.createdAt),
      id: gravado.id,
    },
  };
}

/**
 * O cancelamento ditado.
 *
 * Recebe o id da SESSÃO, nunca "a de amanhã": qual sessão é foi decidido na prévia e mostrado a
 * ela por extenso — paciente, dia e hora — antes do toque. Desmarcar a pessoa errada é o pior que
 * esta voz pode fazer, e é por isso que ela não escolhe aqui.
 */
export async function cancelarPorVoz(sessionId: string): Promise<{ ok: boolean; error?: string; recibo?: ReciboDaVoz }> {
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

  /**
   * O recibo lê o estado DEPOIS do update — e lê o status, que é a coisa que mudou.
   *
   * Um `ok: true` aqui provaria apenas que o update não deu erro. Cancelar é a ação mais pesada da
   * voz (desmarca alguém de verdade): ela merece a prova de que a linha está, agora, cancelada.
   */
  const [depois] = await db.select({
    status: therapySessions.status,
    date: therapySessions.date,
    paciente: patients.name,
  })
    .from(therapySessions)
    .innerJoin(patients, eq(patients.id, therapySessions.patientId))
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)))
    .limit(1);

  if (depois?.status !== "cancelada") return { ok: false, error: "O cancelamento não foi gravado. Tente de novo." };
  return {
    ok: true,
    recibo: {
      comando: "cancelar atendimento",
      paciente: depois.paciente,
      gravado: `Atendimento de ${quandoDoRecibo(depois.date)} está CANCELADO`,
      quando: quandoDoRecibo(agoraParede()),
      id: sessionId,
    },
  };
}
