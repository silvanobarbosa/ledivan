import { db } from "@/db";
import { patients, therapySessions } from "@/db/schema";
import { and, eq, gte, lt, ne } from "drizzle-orm";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import type { EstadoDoDiva } from "@/lib/diva";

/**
 * O QUE O DIVÃ SABE — e de onde ele sabe.
 *
 * Todo número aqui sai de uma consulta ou do motor de cobranças, que é a verdade do app. O modelo
 * não calcula nada: ele só ouve. É o que separa um mentor de um chute convincente — e, numa tela
 * que fala de dinheiro, um chute convincente é o pior defeito possível.
 */
export async function estadoDoDiva(userId: string, agora = new Date()): Promise<EstadoDoDiva> {
  const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const fimDoDia = new Date(inicioDoDia.getTime() + 24 * 60 * 60 * 1000);

  const [doDia, ativos] = await Promise.all([
    db.select({ id: therapySessions.id })
      .from(therapySessions)
      .where(and(
        eq(therapySessions.userId, userId),
        gte(therapySessions.date, inicioDoDia),
        lt(therapySessions.date, fimDoDia),
        eq(therapySessions.status, "agendada"),
      )),
    db.select({ id: patients.id, priceReviewDate: patients.priceReviewDate })
      .from(patients)
      .where(and(eq(patients.userId, userId), ne(patients.patientStatus, "inativo"))),
  ]);

  // Quem não tem NENHUMA sessão daqui para a frente. É a conversa que a terapeuta esquece de ter.
  const futuras = await db.select({ patientId: therapySessions.patientId })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, agora), ne(therapySessions.status, "cancelada")));
  const comFuturo = new Set(futuras.map((f) => f.patientId));
  const semProximoAgendamento = ativos.filter((p) => !comFuturo.has(p.id)).length;

  // Reajuste a vencer: o lembrete aparece a partir de um mês antes da data prevista (regra do app).
  const daquiUmMes = new Date(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
  const reajustesAVencer = ativos.filter((p) => p.priceReviewDate && new Date(p.priceReviewDate) <= daquiUmMes).length;

  /**
   * O atraso sai do MOTOR, paciente a paciente — a mesma conta da guia Geral e do Fechamento.
   *
   * Some os cadastros ativos, o que é mais caro que uma consulta só; em compensação o número do
   * Divã nunca discorda do número da tela para onde ele manda. Dois lugares dizendo valores
   * diferentes sobre dívida é pior do que não dizer.
   */
  let cobrancasEmAtraso = 0;
  let valorEmAtraso = 0;
  const resumos = await Promise.all(ativos.map((p) => geralDoPaciente(userId, p.id).catch(() => null)));
  for (const r of resumos) {
    if (!r) continue;
    cobrancasEmAtraso += r.resumo.nAtraso;
    valorEmAtraso += r.resumo.emAtraso;
  }

  return {
    sessoesHoje: doDia.length,
    cobrancasEmAtraso,
    valorEmAtraso: Math.round(valorEmAtraso * 100) / 100,
    semProximoAgendamento,
    reajustesAVencer,
  };
}
