import { db } from "@/db";
import { auth } from "@/auth";
import { sessionPayments, patients } from "@/db/schema";
import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";
import { Receipt } from "lucide-react";
import { receitaSaudeFields, receitaSaudeCopyText } from "@/lib/receitaSaude";
import { ReceiptCard, IssuedRow, type ReceiptItem } from "./ReceiptCard";

export const dynamic = "force-dynamic";

export default async function ReceitaSaudePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // Pagamentos reais (kind null = não é crédito de pacote) já pagos. Junta dados do paciente.
  const rows = await db.select({
    id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date,
    receiptNumber: sessionPayments.receiptNumber, receiptIssuedAt: sessionPayments.receiptIssuedAt,
    name: patients.name, cpf: patients.cpf, guardianName: patients.guardianName, guardianCpf: patients.guardianCpf,
  })
    .from(sessionPayments)
    .innerJoin(patients, eq(patients.id, sessionPayments.patientId))
    .where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid"), isNull(sessionPayments.kind)))
    .orderBy(desc(sessionPayments.date))
    .limit(500);

  const toItem = (r: (typeof rows)[number]): ReceiptItem => {
    const fields = receitaSaudeFields(
      { amount: r.amount, date: r.date },
      { name: r.name, cpf: r.cpf, guardianName: r.guardianName, guardianCpf: r.guardianCpf },
    );
    return {
      paymentId: r.id,
      patientName: r.name,
      fields,
      copyText: receitaSaudeCopyText(fields),
      issuedAt: r.receiptIssuedAt ? new Date(r.receiptIssuedAt).toISOString() : null,
      receiptNumber: r.receiptNumber,
    };
  };

  const pending = rows.filter((r) => !r.receiptIssuedAt).map(toItem);
  const issued = rows.filter((r) => r.receiptIssuedAt).slice(0, 50).map(toItem);

  // Prazo do ano-calendário: recibos do ano X devem existir até o fim de fev de X+1.
  const now = new Date();
  const calYear = now.getMonth() === 0 && now.getDate() <= 29 ? now.getFullYear() - 1 : now.getFullYear();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Receipt className="w-7 h-7" /> Receita Saúde
        </h1>
        <p className="text-foreground/50 mt-1">
          O Ledivan monta os campos prontos para você emitir o recibo no app <b>Receita Saúde</b> (gov.br) e acompanha o que falta emitir.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-foreground/70">
        A emissão é feita por você no app oficial da Receita Federal (é ato pessoal, com sua conta gov.br). Aqui você copia os dados e marca como emitido.
        Recibos do ano-calendário <b>{calYear}</b> devem ser emitidos até o fim de <b>fevereiro de {calYear + 1}</b>.
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/40">
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-foreground/50 text-sm">Nenhum recibo pendente. 🎉</p>
        ) : (
          <div className="space-y-2">
            {pending.map((it) => <ReceiptCard key={it.paymentId} item={it} />)}
          </div>
        )}
      </section>

      {issued.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/40">Emitidos recentes</h2>
          <div className="space-y-2">
            {issued.map((it) => <IssuedRow key={it.paymentId} item={it} />)}
          </div>
        </section>
      )}
    </div>
  );
}
