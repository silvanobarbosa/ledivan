import { createPatient } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { SubmitButton } from "@/components/SubmitButton";
import { PhotoSlots } from "@/components/dashboard/PhotoSlots";
import { AttendanceFields } from "@/components/dashboard/AttendanceFields";
import { REMINDER_LEAD_OPTIONS } from "@/lib/reminderLead";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseLocations } from "@/lib/locations";

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

export default async function NewPatientPage() {
  const session = await auth();
  const me = session?.user?.id ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) }) : null;
  const locations = parseLocations(me?.attendanceLocations);
  return (
    <div className="max-w-2xl space-y-8">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Novo paciente</h1>
        <p className="text-foreground/50 mt-1">Cadastre os dados do paciente</p>
      </div>

      <form action={createPatient} className="glass-card rounded-[32px] p-6 lg:p-8 space-y-5">
        <div>
          <label className={labelCls}>Nome *</label>
          <input name="name" required className={inputCls} placeholder="Nome completo" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Telefone</label>
            <input name="phone" className={inputCls} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className={labelCls}>E-mail</label>
            <input name="email" type="email" className={inputCls} placeholder="email@exemplo.com" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Frequência<InfoTip text="Com que frequência o paciente é atendido. Ajuda a organizar a agenda." /></label>
            <select name="frequency" className={inputCls} defaultValue="semanal">
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
              <option value="avulso">Avulso</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Início</label>
            <input name="startedAt" type="date" className={inputCls} />
          </div>
        </div>

        <AttendanceFields locations={locations} />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select name="patientStatus" className={inputCls} defaultValue="ativo">
              <option value="ativo">Ativo</option>
              <option value="prospect">Prospect</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-foreground/50 -mt-2">💡 Valor da sessão, contrato/pacote e dia de pagamento são definidos depois, na aba <strong>Financeiro</strong> do paciente.</p>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Contato de emergência</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <input name="emergencyName" className={inputCls} placeholder="Nome" />
            <input name="emergencyPhone" className={inputCls} placeholder="Telefone" />
            <input name="emergencyRelationship" className={inputCls} placeholder="Parentesco" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Endereço</label>
          <input name="address" className={inputCls} placeholder="Endereço" />
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Lembrete de sessão<InfoTip text="Se ligado, o sistema envia um lembrete automático antes da sessão pelo canal escolhido (precisa ter o canal conectado em Ajustes)." /></p>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" name="reminderEnabled" className="accent-primary w-4 h-4" />
            Enviar lembrete automático antes da sessão
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Canal do lembrete</label>
              <select name="reminderChannel" className={inputCls} defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Antecedência<InfoTip text="Quanto tempo antes da sessão o lembrete é enviado." /></label>
              <select name="reminderLeadMinutes" className={inputCls} defaultValue={60}>
                {REMINDER_LEAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Etiquetas (separadas por vírgula)<InfoTip text="Marcadores livres para organizar e filtrar pacientes na lista. Ex: TCC, ansiedade, casal." /></label>
          <input name="tags" className={inputCls} placeholder="ex: TCC, ansiedade, quinzenal" />
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Fotos<InfoTip text="A foto 3x4 é a referência do cadastro. As outras 3 são opcionais." /></p>
          <PhotoSlots />
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea name="notes" rows={3} className={inputCls} placeholder="Anotações sobre o paciente" />
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Cadastrando…" className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] transition">
            Cadastrar paciente
          </SubmitButton>
          <Link href="/dashboard/patients" className="px-6 py-3.5 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
