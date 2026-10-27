import { db } from "@/db";
import { auth } from "@/auth";
import { sessionPayments, patients } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Banknote } from "lucide-react";
import { PagamentosClient } from "./PagamentosClient";
import { getVigenciasTaxa } from "@/lib/cardFees";

export const dynamic = "force-dynamic";
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const now = new Date();
  const year = Number((await searchParams).year) || now.getFullYear();
  const start = new Date(year, 0, 1), end = new Date(year, 11, 31, 23, 59, 59);

  const [pays, pats] = await Promise.all([
    db.select({ patientId: sessionPayments.patientId, amount: sessionPayments.amount, date: sessionPayments.date, method: sessionPayments.method, status: sessionPayments.status, kind: sessionPayments.kind })
      .from(sessionPayments).where(and(eq(sessionPayments.userId, userId), gte(sessionPayments.date, start), lte(sessionPayments.date, end))),
    db.select({ id: patients.id, name: patients.name, phone: patients.phone, status: patients.patientStatus }).from(patients).where(eq(patients.userId, userId)),
  ]);

  // Quadro 1 (por cadastro): recebido por mês quebrado por forma (bruto+líquido). Precisa da forma e
  // da data de cada pagamento + das vigências de taxa (doc 50).
  const vigencias = await getVigenciasTaxa(userId);
  const paymentsLite = pays.filter((p) => p.status === "paid" && p.kind !== "pacote")
    .map((p) => ({ patientId: p.patientId, ym: ym(new Date(p.date)), data: new Date(p.date).toISOString(), amount: Number(p.amount) || 0, method: p.method ?? "" }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Banknote className="w-7 h-7" /> Carteira
        </h1>
        <p className="text-foreground/50 mt-1 text-justify">Recebimentos por <strong>mês</strong>, por <strong>pessoa atendida</strong> e <strong>total geral</strong>, com acompanhamento dos <strong>valores recebidos</strong> e <strong>cobrança dos pagamentos em aberto</strong>.</p>
      </div>
      <PagamentosClient
        year={year}
        patients={pats.filter((p) => p.status !== "prospect").map((p) => ({ id: p.id, name: p.name }))}
        payments={paymentsLite}
        vigencias={vigencias}
      />
    </div>
  );
}
