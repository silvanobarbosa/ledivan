import { createPatient } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

export default function NewPatientPage() {
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
            <label className={labelCls}>Valor da sessão (R$)</label>
            <input name="sessionFee" inputMode="decimal" className={inputCls} placeholder="0,00" />
          </div>
          <div>
            <label className={labelCls}>Frequência</label>
            <select name="frequency" className={inputCls} defaultValue="semanal">
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
              <option value="avulso">Avulso</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo de contrato</label>
            <select name="contractType" className={inputCls} defaultValue="avulso">
              <option value="avulso">Avulso</option>
              <option value="pacote">Pacote</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Início</label>
            <input name="startedAt" type="date" className={inputCls} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dia de pagamento</label>
            <input name="paymentDay" type="number" min={1} max={31} className={inputCls} placeholder="ex: 5" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select name="patientStatus" className={inputCls} defaultValue="ativo">
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

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
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Lembrete de sessão</p>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" name="reminderEnabled" className="accent-primary w-4 h-4" />
            Enviar lembrete automático antes da sessão
          </label>
          <label className={labelCls}>Canal do lembrete</label>
          <select name="reminderChannel" className={inputCls} defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
            <option value="telegram">Telegram</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Etiquetas (separadas por vírgula)</label>
          <input name="tags" className={inputCls} placeholder="ex: TCC, ansiedade, quinzenal" />
        </div>

        <div>
          <label className={labelCls}>Observações</label>
          <textarea name="notes" rows={3} className={inputCls} placeholder="Anotações sobre o paciente" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="flex-1 bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition">
            Cadastrar paciente
          </button>
          <Link href="/dashboard/patients" className="px-6 py-3.5 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
