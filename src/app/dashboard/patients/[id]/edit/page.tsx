import { db } from "@/db";
import { auth } from "@/auth";
import { patients, patientPriceHistory } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updatePatient, deletePatient } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFormFields } from "@/components/dashboard/PatientFormFields";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.userId, session.user.id)),
  });
  if (!patient) notFound();

  // Histórico de reajuste para a aba Financeiro mostrar a lista pedida pelo dono: data, valor
  // anterior e valor novo. O "anterior" sai da linha de antes, no próprio componente.
  const priceHistory = await db.select({ valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
    .from(patientPriceHistory)
    .where(eq(patientPriceHistory.patientId, id));

  const save = updatePatient.bind(null, id);
  const remove = deletePatient.bind(null, id);
  const iso = (d: unknown) => (d ? (d as Date).toISOString() : null);

  return (
    <div className="max-w-2xl space-y-8">
      <Link href={`/dashboard/patients/${id}`} className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Editar paciente</h1>
        <p className="text-foreground/50 mt-1">{patient.name}</p>
      </div>

      <form action={save} className="space-y-5">
        <PatientFormFields p={{
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
          priceHistory: priceHistory.map((h) => ({ valor: h.valor, dataEfetiva: (h.dataEfetiva as Date).toISOString() })),
          reminderEnabled: patient.reminderEnabled, reminderChannel: patient.reminderChannel, reminderLeadMinutes: patient.reminderLeadMinutes,
          photo3x4: patient.photo3x4, photoExtra1: patient.photoExtra1, photoExtra2: patient.photoExtra2, photoExtra3: patient.photoExtra3,
        }} />
        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Salvando…" className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] transition">
            Salvar alterações
          </SubmitButton>
          <Link href={`/dashboard/patients/${id}`} className="px-6 py-3.5 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">
            Cancelar
          </Link>
        </div>
      </form>

      <form action={remove} className="flex justify-end">
        <SubmitButton pendingLabel="Excluindo…" className="inline-flex items-center gap-2 text-sm font-semibold text-red-500/70 hover:text-red-600 transition px-4 py-2">
          Excluir paciente
        </SubmitButton>
      </form>
    </div>
  );
}
