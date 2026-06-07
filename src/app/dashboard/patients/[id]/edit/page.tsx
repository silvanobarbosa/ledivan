import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updatePatient, deletePatient } from "../../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoTip } from "@/components/InfoTip";
import { ContractFields } from "@/components/dashboard/ContractFields";
import { PhotoSlots } from "@/components/dashboard/PhotoSlots";
import { AttendanceFields } from "@/components/dashboard/AttendanceFields";
import { REMINDER_LEAD_OPTIONS } from "@/lib/reminderLead";
import { users } from "@/db/schema";
import { parseLocations } from "@/lib/locations";

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

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

  return (
    <div className="max-w-2xl space-y-8">
      <Link href={`/dashboard/patients/${id}`} className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Editar paciente</h1>
        <p className="text-foreground/50 mt-1">{patient.name}</p>
      </div>

      <form action={save} className="glass-card rounded-[32px] p-6 lg:p-8 space-y-5">
        <div>
          <label className={labelCls}>Nome *</label>
          <input name="name" required defaultValue={patient.name} className={inputCls} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Telefone</label>
            <input name="phone" defaultValue={patient.phone ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input name="email" type="email" defaultValue={patient.email ?? ""} className={inputCls} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Valor da sessão (R$)</label>
            <input name="sessionFee" inputMode="decimal" defaultValue={patient.sessionFee} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Frequência</label>
            <select name="frequency" className={inputCls} defaultValue={patient.frequency ?? "semanal"}>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
              <option value="avulso">Avulso</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <ContractFields defaultType={patient.contractType ?? "avulso"} defaultSessions={patient.sessionsInPacket} defaultDeduct={patient.deductPackageOnSession} />
          <div>
            <label className={labelCls}>Status</label>
            <select name="patientStatus" className={inputCls} defaultValue={patient.patientStatus}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <AttendanceFields locations={locations} defaultMode={patient.attendanceMode ?? "presencial"} defaultLocation={patient.attendanceLocation} />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dia de pagamento</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={patient.paymentDay ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Endereço</label>
            <input name="address" defaultValue={patient.address ?? ""} className={inputCls} />
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Contato de emergência</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <input name="emergencyName" defaultValue={patient.emergencyName ?? ""} placeholder="Nome" className={inputCls} />
            <input name="emergencyPhone" defaultValue={patient.emergencyPhone ?? ""} placeholder="Telefone" className={inputCls} />
            <input name="emergencyRelationship" defaultValue={patient.emergencyRelationship ?? ""} placeholder="Parentesco" className={inputCls} />
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Lembrete de sessão</p>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" name="reminderEnabled" defaultChecked={patient.reminderEnabled} className="accent-primary w-4 h-4" />
            Enviar lembrete automático antes da sessão
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Canal do lembrete</label>
              <select name="reminderChannel" className={inputCls} defaultValue={patient.reminderChannel}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Antecedência<InfoTip text="Quanto tempo antes da sessão o lembrete é enviado." /></label>
              <select name="reminderLeadMinutes" className={inputCls} defaultValue={patient.reminderLeadMinutes ?? 60}>
                {REMINDER_LEAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Etiquetas (separadas por vírgula)</label>
          <input name="tags" defaultValue={patient.tags ?? ""} className={inputCls} placeholder="ex: TCC, ansiedade, quinzenal" />
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Fotos<InfoTip text="A foto 3x4 é a referência do cadastro. As outras 3 são opcionais." /></p>
          <PhotoSlots
            initial={{
              photo3x4: patient.photo3x4,
              photoExtra1: patient.photoExtra1,
              photoExtra2: patient.photoExtra2,
              photoExtra3: patient.photoExtra3,
            }}
          />
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea name="notes" rows={3} defaultValue={patient.notes ?? ""} className={inputCls} />
        </div>

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
