import { db } from "@/db";
import { auth } from "@/auth";
import { patients, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updatePatient, deletePatient } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFormFields } from "@/components/dashboard/PatientFormFields";
import { parseLocations } from "@/lib/locations";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, id), eq(patients.userId, session.user.id)),
  });
  if (!patient) notFound();

  const me = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  const locations = parseLocations(me?.attendanceLocations);

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
        <PatientFormFields locations={locations} p={{
          name: patient.name, phone: patient.phone, email: patient.email, patientStatus: patient.patientStatus,
          startedAt: iso(patient.startedAt), birthDate: iso(patient.birthDate), category: patient.category, gender: patient.gender, cpf: patient.cpf, address: patient.address,
          guardianName: patient.guardianName, guardianCpf: patient.guardianCpf, guardianPhone: patient.guardianPhone, guardianEmail: patient.guardianEmail,
          spouseName: patient.spouseName, spousePhone: patient.spousePhone, spouseEmail: patient.spouseEmail, spouseCpf: patient.spouseCpf,
          emergencyName: patient.emergencyName, emergencyPhone: patient.emergencyPhone, emergencyEmail: patient.emergencyEmail, emergencyRelationship: patient.emergencyRelationship,
          attendanceMode: patient.attendanceMode, attendanceLocation: patient.attendanceLocation, attendanceDay: patient.attendanceDay, attendanceTime: patient.attendanceTime,
          sessionFee: patient.sessionFee, frequency: patient.frequency, paymentFormat: patient.paymentFormat, sessionsInPacket: patient.sessionsInPacket, paymentDay: patient.paymentDay, priceReviewDate: iso(patient.priceReviewDate),
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
