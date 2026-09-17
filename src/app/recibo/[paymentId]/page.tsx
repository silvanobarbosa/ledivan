import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { sessionPayments } from "@/db/schema";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/**
 * O RECIBO ANTIGO — hoje só uma porta para o novo.
 *
 * Esta página desenhava um recibo próprio, com logotipo do sistema. O documento de 17/09 pede o
 * contrário (sem logotipo, valor por extenso, as datas dos atendimentos), e esse recibo passou a ser
 * montado em `/dashboard/patients/[id]/recibo/[pagamentoId]`. Dois recibos com formatos diferentes
 * para o mesmo pagamento é o tipo de coisa que só se descobre quando o paciente compara dois papéis.
 *
 * O endereço fica de pé porque pode estar salvo em algum favorito — mas leva ao único recibo que
 * existe agora.
 */
export default async function ReciboAntigo({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId)) notFound();

  const [pagamento] = await db
    .select({ patientId: sessionPayments.patientId })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, session.user.id)))
    .limit(1);
  if (!pagamento) notFound();

  redirect(`/dashboard/patients/${pagamento.patientId}/recibo/${paymentId}`);
}
