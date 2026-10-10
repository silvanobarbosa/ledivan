import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { auth } from "@/auth";
import { montarContrato } from "@/lib/contrato";
import { horaDeParede } from "@/lib/horaLocal";
import { ContratoImpresso } from "@/components/ContratoImpresso";

export const dynamic = "force-dynamic";

/**
 * O CONTRATO do paciente (doc 9, menu Contratos). Abre já preenchido com o que o sistema tem — dados
 * da analista (Ajustes) e do paciente/responsável (cadastro) — e deixa o resto editável para imprimir,
 * no mesmo espírito do recibo. O texto sai de `src/lib/contrato.ts`, puro e testado.
 */
export default async function Contrato({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const { id: patientId } = await params;

  const [paciente] = await db
    .select({
      name: patients.name,
      birthDate: patients.birthDate,
      cpf: patients.cpf,
      guardianName: patients.guardianName,
      guardianCpf: patients.guardianCpf,
      address: patients.address,
      phone: patients.phone,
      guardianPhone: patients.guardianPhone,
      sessionFee: patients.sessionFee,
      validadePrecoMeses: patients.validadePrecoMeses,
    })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!paciente) notFound();

  const prof = await db.query.users.findFirst({ where: eq(users.id, userId) });

  const texto = montarContrato({
    analistaNome: prof?.name ?? null,
    analistaCpf: prof?.therapistCpf ?? null,
    descricaoAtendimento: prof?.descricaoAtendimento ?? null,
    pacienteNome: paciente.name,
    pacienteNascimento: paciente.birthDate ? new Date(horaDeParede(paciente.birthDate)) : null,
    pacienteCpf: paciente.cpf,
    responsavelNome: paciente.guardianName,
    responsavelCpf: paciente.guardianCpf,
    pacienteEndereco: paciente.address,
    pacienteTelefone: paciente.phone,
    responsavelTelefone: paciente.guardianPhone,
    valorSessao: paciente.sessionFee,
    reajusteMeses: paciente.validadePrecoMeses,
  });

  return <ContratoImpresso texto={texto} patientId={patientId} />;
}
