import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { RelatorioPacientes } from "./RelatorioPacientes";

export const dynamic = "force-dynamic";

/**
 * Relatório de pacientes: a tela que o painel "Relatórios" do dashboard abre.
 *
 * Fica separada do /dashboard/reports de propósito — aquele é FINANCEIRO (receita, despesa,
 * saldo). Este é cadastral: quem são os pacientes, com que contrato, desde quando.
 *
 * Carrega tudo de uma vez e filtra no cliente. São dezenas ou centenas de pacientes por
 * terapeuta, não milhares: paginar no servidor aqui custaria mais em ida-e-volta do que economiza.
 */
export default async function RelatorioPacientesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const linhas = await db
    .select({
      id: patients.id,
      name: patients.name,
      status: patients.patientStatus,
      gender: patients.gender,
      email: patients.email,
      phone: patients.phone,
      address: patients.address,
      schoolName: patients.schoolName,
      birthDate: patients.birthDate,
      startedAt: patients.startedAt,
      priceReviewDate: patients.priceReviewDate,
      paymentFormat: patients.paymentFormat,
      contractType: patients.contractType,
      paymentDay: patients.paymentDay,
      dueDateType: patients.dueDateType,
      dueDate: patients.dueDate,
      sessionFee: patients.sessionFee,
      queixaPrincipal: patients.queixaPrincipal,
    })
    .from(patients)
    .where(eq(patients.userId, session.user.id));

  const iso = (d: Date | null) => (d ? (d as unknown as string) : null);

  return (
    <div className="max-w-7xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <ClipboardList className="w-7 h-7" /> Relatório de pacientes
        </h1>
        <p className="text-foreground/50 mt-1">
          Escolha o tipo, o período de início e as colunas que quer ver. O relatório monta na hora.
        </p>
      </div>

      <RelatorioPacientes
        linhas={linhas.map((p) => ({
          ...p,
          birthDate: iso(p.birthDate),
          startedAt: iso(p.startedAt),
          priceReviewDate: iso(p.priceReviewDate),
          dueDate: iso(p.dueDate),
        }))}
      />
    </div>
  );
}
