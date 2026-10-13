import { db } from "@/db";
import { auth } from "@/auth";
import { patients, patientPriceHistory, patientPaymentFormatHistory, patientReajusteChanges, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updatePatient, deletePatient } from "../../actions";
import { PatientFormFields } from "@/components/dashboard/PatientFormFields";
import { ExcluirPaciente } from "./ExcluirPaciente";
import { montarContrato } from "@/lib/contrato";
import { enquadreDaAgenda } from "@/lib/enquadreContrato";
import { horaDeParede } from "@/lib/horaLocal";
import { ContratoImpresso } from "@/components/ContratoImpresso";

export default async function EditPatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ guia?: string }> }) {
  const { id } = await params;
  const guia = (await searchParams)?.guia;
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.userId, session.user.id)),
  });
  if (!patient) notFound();

  // Histórico de reajuste para a aba Financeiro mostrar a lista pedida pelo dono: data, valor
  // anterior e valor novo. O "anterior" sai da linha de antes, no próprio componente.
  const priceHistory = await db.select({ valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva, dataCriacao: patientPriceHistory.dataCriacao })
    .from(patientPriceHistory)
    .where(eq(patientPriceHistory.patientId, id));

  // Histórico de MODALIDADE (gratuito, a cada sessão, mensal…) — o reajuste também mostra a troca de
  // formato, não só de valor (dono, 16/09/2026).
  const formatHistory = await db.select({ formato: patientPaymentFormatHistory.formato, dataEfetiva: patientPaymentFormatHistory.dataEfetiva, dataCriacao: patientPaymentFormatHistory.dataCriacao })
    .from(patientPaymentFormatHistory)
    .where(eq(patientPaymentFormatHistory.patientId, id));

  // Doc 33 (F15): mudanças de configuração (nº sessões, vencimento, pagar até, intervalo, pacote).
  const reajusteChanges = await db.select({ id: patientReajusteChanges.id, campo: patientReajusteChanges.campo, de: patientReajusteChanges.de, para: patientReajusteChanges.para, at: patientReajusteChanges.at, vigencia: patientReajusteChanges.vigencia })
    .from(patientReajusteChanges)
    .where(eq(patientReajusteChanges.patientId, id));

  const save = updatePatient.bind(null, id);
  const remove = deletePatient.bind(null, id);
  const iso = (d: unknown) => (d ? (d as Date).toISOString() : null);

  // Doc 22: a aba "Contrato" mostra o mesmo contrato do menu Contratos, montado aqui (servidor) com
  // os dados da analista (Ajustes) e do paciente/responsável (cadastro). Igual a /contrato.
  const prof = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const enq = await enquadreDaAgenda(session.user.id, id, patient.timesPerPeriod);
  // Doc 28/30: o modelo padrão é sempre gerado (p/ Restaurar); o contrato salvo tem prioridade.
  const contratoPadrao = montarContrato({
    analistaNome: prof?.name ?? null,
    analistaCpf: prof?.therapistCpf ?? null,
    descricaoAtendimento: prof?.descricaoAtendimento ?? null,
    analistaConselho: prof?.conselho ?? null,
    analistaEndereco: prof?.enderecoContrato ?? null,
    analistaPlataforma: prof?.plataformaOnline ?? null,
    analistaTelefone: prof?.therapistPhone ?? null,
    analistaEmail: prof?.email ?? null,
    cidade: prof?.cidade ?? null,
    estado: prof?.estado ?? null,
    pacienteNome: patient.name,
    pacienteNascimento: patient.birthDate ? new Date(horaDeParede(patient.birthDate)) : null,
    pacienteCpf: patient.cpf,
    responsavelNome: patient.guardianName,
    responsavelCpf: patient.guardianCpf,
    pacienteEndereco: patient.address,
    pacienteTelefone: patient.phone,
    responsavelTelefone: patient.guardianPhone,
    valorSessao: patient.sessionFee,
    reajusteMeses: patient.validadePrecoMeses,
    duracaoMaxMin: enq.duracaoMaxMin,
    recorrencia: enq.recorrencia,
    horarioFixo: enq.horarioFixo,
    formatoPagamento: patient.paymentFormat,
    diaPagamento: patient.paymentDay,
    diaPagamento2: patient.paymentDay2,
    horasAntesPagamento: patient.horasAntesPagamento,
    hoje: new Date(),
  });
  const contratoTexto = patient.contratoTexto ?? contratoPadrao;

  return (
    <div className="max-w-2xl space-y-8">
      <Link href={`/dashboard/patients/${id}`} className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Editar paciente</h1>
        <p className="text-foreground/50 mt-1">{patient.name}</p>
      </div>

      <div className="space-y-5">
        <PatientFormFields save={save} patientId={id} tabInicial={guia === "financeiro" ? "financeiro" : guia === "contrato" ? "contrato" : undefined} contrato={<ContratoImpresso texto={contratoTexto} textoPadrao={contratoPadrao} patientId={id} logoUrl={prof?.logoUrl ?? null} />} p={{
          registrationNumber: patient.registrationNumber, agendaId: patient.agendaId, dueDateType: patient.dueDateType, dueDate: iso(patient.dueDate), queixaPrincipal: patient.queixaPrincipal,
          name: patient.name, phone: patient.phone, email: patient.email, patientStatus: patient.patientStatus,
          startedAt: iso(patient.startedAt), birthDate: iso(patient.birthDate), category: patient.category, isCouple: patient.isCouple, guardianRelationship: patient.guardianRelationship,
          devolutivaMeses: patient.devolutivaMeses, gender: patient.gender, cpf: patient.cpf, address: patient.address, schoolName: patient.schoolName, schoolContact: patient.schoolContact,
          guardianName: patient.guardianName, guardianCpf: patient.guardianCpf, guardianPhone: patient.guardianPhone, guardianEmail: patient.guardianEmail,
          spouseName: patient.spouseName, spousePhone: patient.spousePhone, spouseEmail: patient.spouseEmail, spouseCpf: patient.spouseCpf,
          spouseBirthDate: iso(patient.spouseBirthDate), spouseQueixaPrincipal: patient.spouseQueixaPrincipal, spouseGender: patient.spouseGender, spouseAddress: patient.spouseAddress,
          emergencyName: patient.emergencyName, emergencyPhone: patient.emergencyPhone, emergencyEmail: patient.emergencyEmail, emergencyRelationship: patient.emergencyRelationship,
          attendanceMode: patient.attendanceMode, attendanceLocation: patient.attendanceLocation, attendanceDay: patient.attendanceDay, attendanceTime: patient.attendanceTime,
          sessionFee: patient.sessionFee, frequency: patient.frequency, timesPerPeriod: patient.timesPerPeriod, paymentFormat: patient.paymentFormat, sessionsInPacket: patient.sessionsInPacket, paymentDay: patient.paymentDay, priceReviewDate: iso(patient.priceReviewDate),
          horasAntesPagamento: patient.horasAntesPagamento, validadePrecoMeses: patient.validadePrecoMeses,
          pacoteTipo: patient.pacoteTipo, semanasNoMes: patient.semanasNoMes, paymentDay2: patient.paymentDay2,
          priceHistory: priceHistory.map((h) => ({ valor: h.valor, dataEfetiva: (h.dataEfetiva as Date).toISOString(), dataCriacao: (h.dataCriacao as Date | null)?.toISOString() ?? null })),
          formatHistory: formatHistory.map((h) => ({ formato: h.formato, dataEfetiva: (h.dataEfetiva as Date).toISOString(), dataCriacao: (h.dataCriacao as Date | null)?.toISOString() ?? null })),
          reajusteChanges: reajusteChanges.map((c) => ({ id: c.id, campo: c.campo, de: c.de, para: c.para, at: (c.at as Date).toISOString(), vigencia: (c.vigencia as Date | null)?.toISOString() ?? null })),
          reminderEnabled: patient.reminderEnabled, reminderChannel: patient.reminderChannel, reminderLeadMinutes: patient.reminderLeadMinutes,
          photo3x4: patient.photo3x4, photoExtra1: patient.photoExtra1, photoExtra2: patient.photoExtra2, photoExtra3: patient.photoExtra3,
        }} />
        <div className="flex justify-end pt-1">
          <Link href={`/dashboard/patients/${id}`} className="px-6 py-3.5 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">
            Cancelar
          </Link>
        </div>
      </div>

      <ExcluirPaciente remove={remove} />
    </div>
  );
}
