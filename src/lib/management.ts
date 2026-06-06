import { db } from "@/db";
import { patients } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

export type MgmtFlag = "pagamento_atrasado" | "pagamento_pendente" | "pacote_zerado" | "pacote_acabando" | "reajuste_vencendo";

export const MGMT_FLAG_LABELS: Record<MgmtFlag, string> = {
  pagamento_atrasado: "Pagamento atrasado",
  pagamento_pendente: "Pagamento pendente",
  pacote_zerado: "Pacote zerado",
  pacote_acabando: "Pacote acabando (1)",
  reajuste_vencendo: "Reajuste a revisar",
};

const DAY = 86400000;

// Pacientes que pedem atenção de GESTÃO (financeiro/contrato), não clínica.
export async function getManagementFlags(userId: string): Promise<{ id: string; name: string; flags: MgmtFlag[] }[]> {
  const pats = await db.query.patients.findMany({
    where: and(eq(patients.userId, userId), ne(patients.patientStatus, "inativo")),
  });
  const now = Date.now();
  const soon = now + 10 * DAY; // reajuste vencido ou a vencer em 10 dias
  const out: { id: string; name: string; flags: MgmtFlag[] }[] = [];

  for (const p of pats) {
    const flags: MgmtFlag[] = [];
    if (p.paymentStatus === "overdue") flags.push("pagamento_atrasado");
    else if (p.paymentStatus === "pending" && p.patientStatus === "ativo") flags.push("pagamento_pendente");

    if (p.contractType === "pacote" && p.sessionsInPacket) {
      const left = p.sessionsInPacket - (p.packageCreditsUsed ?? 0);
      if (left <= 0) flags.push("pacote_zerado");
      else if (left === 1) flags.push("pacote_acabando");
    }

    if (p.priceReviewDate && new Date(p.priceReviewDate).getTime() <= soon) flags.push("reajuste_vencendo");

    if (flags.length) out.push({ id: p.id, name: p.name, flags });
  }
  // ordena por mais flags primeiro
  return out.sort((a, b) => b.flags.length - a.flags.length);
}
