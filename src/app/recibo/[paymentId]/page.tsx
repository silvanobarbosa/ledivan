import { db } from "@/db";
import { auth } from "@/auth";
import { sessionPayments, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatBRL, formatDate, PAYMENT_METHOD_LABELS } from "@/lib/therapy";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ReciboPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const payment = await db.query.sessionPayments.findFirst({
    where: and(eq(sessionPayments.id, paymentId), eq(sessionPayments.userId, userId)),
    with: { patient: { columns: { name: true } } },
  });
  if (!payment) notFound();

  const therapist = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const numero = paymentId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-[#faf6f1] py-10 px-4 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-between items-center print:hidden">
          <a href={`/dashboard/patients/${payment.patientId}`} className="text-sm text-[#6b5b6f] hover:text-[#2b1830]">← Voltar</a>
          <PrintButton />
        </div>

        <div className="bg-white rounded-[24px] border border-[#e7ddd4] p-10 print:border-0 print:rounded-none print:p-0">
          <div className="flex items-center justify-between border-b border-[#e7ddd4] pb-6">
            <img src="/landing/logo-ledivan.png" alt="L'E-Divan" className="h-14 w-auto" />
            <div className="text-right">
              <p className="font-display text-2xl font-semibold text-[#2b1830]">Recibo</p>
              <p className="text-xs text-[#6b5b6f]">Nº {numero}</p>
            </div>
          </div>

          <div className="py-8 space-y-6 text-[#1a0f1f]">
            <p className="text-lg leading-relaxed">
              Recebi de <strong>{payment.patient?.name ?? "—"}</strong> a quantia de{" "}
              <strong>{formatBRL(payment.amount)}</strong>, referente a serviço de psicoterapia
              {payment.method ? ` (pagamento via ${PAYMENT_METHOD_LABELS[payment.method] ?? payment.method})` : ""}.
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Valor" value={formatBRL(payment.amount)} />
              <Field label="Data do pagamento" value={formatDate(payment.date)} />
              <Field label="Forma de pagamento" value={PAYMENT_METHOD_LABELS[payment.method] ?? payment.method} />
              <Field label="Situação" value={payment.status === "paid" ? "Pago" : payment.status} />
            </div>
          </div>

          <div className="pt-10 mt-6 border-t border-[#e7ddd4] text-center">
            <p className="font-display text-lg text-[#2b1830]">{therapist?.name ?? "Terapeuta"}</p>
            <p className="text-xs text-[#6b5b6f] mt-1">Emitido em {formatDate(new Date())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b5b6f]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
