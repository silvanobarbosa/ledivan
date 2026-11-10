import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { geralDoPaciente, type LinhaNaTela } from "@/lib/geralDoPaciente";
import { getVigenciasTaxa } from "@/lib/cardFees";
import { resolverCobrancas } from "@/lib/resolverCobrancas";
import { vencimentosNoDia, type CobrancaResolvida } from "@/lib/vencimentosDoDia";

/**
 * As cobranças de UM terapeuta que vencem num dia — o motor por trás do painel de Vencimentos.
 *
 * Saiu da Server Action para cá (doc 63) porque o aviso diário precisa da mesma conta sem ter uma
 * sessão de navegador: o cron sabe o `userId` e não tem `auth()`. Duas contas de vencimento seriam
 * duas respostas diferentes para a mesma pergunta — e a que ninguém olha é a que erra calada.
 */
export async function vencimentosDoUsuarioEm(
  userId: string,
  diaISO: string,
): Promise<{ avulsas: CobrancaResolvida[]; pacotes: CobrancaResolvida[] }> {
  const vigencias = await getVigenciasTaxa(userId);
  const lista = (
    await db
      .select({
        id: patients.id, name: patients.name, phone: patients.phone, guardianPhone: patients.guardianPhone,
        paymentFormat: patients.paymentFormat, horasAntesPagamento: patients.horasAntesPagamento,
        registrationNumber: patients.registrationNumber, agendaId: patients.agendaId, status: patients.patientStatus,
      })
      .from(patients)
      .where(eq(patients.userId, userId))
  ).filter((p) => p.status === "ativo");

  const todas: CobrancaResolvida[] = [];
  await Promise.all(
    lista.map(async (p) => {
      const geral = await geralDoPaciente(userId, p.id);
      if (!geral) return;
      todas.push(...resolverCobrancas(geral.linhas as LinhaNaTela[], p, vigencias));
    }),
  );

  return vencimentosNoDia(todas, diaISO);
}
