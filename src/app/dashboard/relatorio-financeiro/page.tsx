import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Wallet } from "lucide-react";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import type { PacienteFin } from "@/lib/matrizFinanceira";
import { RelatorioFinanceiro } from "./RelatorioFinanceiro";

export const dynamic = "force-dynamic";

/**
 * Relatório financeiro dos pacientes (doc 41): a matriz paciente × mês, por situação de pagamento.
 *
 * Carrega as cobranças de cada paciente pelo MOTOR único (`geralDoPaciente`) — a mesma conta da guia
 * Geral, então os valores batem com o que a terapeuta vê no paciente. Agrega no cliente (filtros de
 * situação e ano reagem sem nova consulta). São dezenas/centenas de pacientes, não milhares.
 */
export default async function RelatorioFinanceiroPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const lista = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(eq(patients.userId, userId));

  const dados = await Promise.all(
    lista.map(async (p): Promise<PacienteFin> => {
      const geral = await geralDoPaciente(userId, p.id);
      const cobrancas = (geral?.linhas ?? [])
        .filter((l) => l.tipo === "pagamento")
        .map((l) => {
          const c = l as Extract<typeof l, { tipo: "pagamento" }>;
          return {
            vencimento: c.vencimento,
            situacao: c.situacao,
            falta: c.falta,
            pagamentos: c.pagamentos.map((pg) => ({ data: pg.data, valor: pg.valor, credito: pg.credito })),
          };
        });
      return { id: p.id, nome: p.name, cobrancas };
    }),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-20">
      <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
        <Wallet className="w-7 h-7" /> Relatório financeiro
      </h1>
      <RelatorioFinanceiro pacientes={dados} />
    </div>
  );
}
