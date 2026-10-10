import "server-only";
import { and, desc, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { horaDeParede } from "./horaLocal";

/**
 * O enquadre (duração, frequência, horário fixo) do contrato vem da AGENDA do paciente (doc 26):
 * a maior duração já cadastrada e a recorrência/horário da ÚLTIMA sessão agendada. Sem sessão, os
 * campos voltam nulos e o contrato mantém os placeholders [ex: ...].
 */
export async function enquadreDaAgenda(userId: string, patientId: string, vezesPorSemana: number) {
  const [dur] = await db
    .select({ m: max(therapySessions.duration) })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), eq(therapySessions.patientId, patientId)));

  const [ultima] = await db
    .select({ date: therapySessions.date, freq: therapySessions.recurrenceFreq, recurring: therapySessions.recurring })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), eq(therapySessions.patientId, patientId)))
    .orderBy(desc(therapySessions.date))
    .limit(1);

  return {
    duracaoMaxMin: dur?.m ?? null,
    recorrencia: ultima ? { freq: ultima.freq, vezesPorSemana, repete: ultima.recurring } : null,
    horarioFixo: ultima ? new Date(horaDeParede(ultima.date)) : null,
  };
}
