"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { AttendanceFields } from "@/components/dashboard/AttendanceFields";
import { PhotoSlots } from "@/components/dashboard/PhotoSlots";
import { REMINDER_LEAD_OPTIONS } from "@/lib/reminderLead";

const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";
const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export type PatientFormData = {
  name?: string; phone?: string | null; email?: string | null; patientStatus?: string;
  startedAt?: string | null; birthDate?: string | null; category?: string | null; cpf?: string | null; address?: string | null;
  guardianName?: string | null; guardianCpf?: string | null;
  emergencyName?: string | null; emergencyPhone?: string | null; emergencyRelationship?: string | null;
  attendanceMode?: string | null; attendanceLocation?: string | null; attendanceDay?: string | null; attendanceTime?: string | null;
  sessionFee?: string | null; frequency?: string | null; paymentFormat?: string | null; sessionsInPacket?: number | null; paymentDay?: number | null; priceReviewDate?: string | null;
  reminderEnabled?: boolean; reminderChannel?: string | null; reminderLeadMinutes?: number | null;
  photo3x4?: string | null; photoExtra1?: string | null; photoExtra2?: string | null; photoExtra3?: string | null;
};

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-border bg-white/40 overflow-hidden">
      <summary className="flex items-center justify-between cursor-pointer px-5 py-4 list-none select-none">
        <span className="font-display font-bold text-primary">{title}</span>
        <ChevronDown className="w-5 h-5 text-foreground/40 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>
    </details>
  );
}

export function PatientFormFields({ p, locations }: { p?: PatientFormData; locations: { name: string; address: string }[] }) {
  const [format, setFormat] = useState(p?.paymentFormat || "avulso");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <div className="space-y-3">
      {/* 1. Dados pessoais */}
      <Section title="Dados pessoais" open>
        <div>
          <label className={labelCls}>Nome *</label>
          <input name="name" required defaultValue={p?.name ?? ""} className={inputCls} placeholder="Nome completo" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Telefone</label><input name="phone" defaultValue={p?.phone ?? ""} className={inputCls} placeholder="(00) 00000-0000" /></div>
          <div><label className={labelCls}>E-mail</label><input name="email" type="email" defaultValue={p?.email ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
          <div><label className={labelCls}>Data de nascimento</label><input name="birthDate" type="date" defaultValue={dateVal(p?.birthDate)} className={inputCls} /></div>
          <div>
            <label className={labelCls}>Classificação</label>
            <select name="category" className={inputCls} defaultValue={p?.category || ""}>
              <option value="">—</option>
              <option value="crianca">Criança</option>
              <option value="adolescente">Adolescente</option>
              <option value="adulto">Adulto</option>
              <option value="idoso">Idoso</option>
              <option value="casal">Casal</option>
            </select>
          </div>
          <div><label className={labelCls}>CPF</label><input name="cpf" defaultValue={p?.cpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
          <div>
            <label className={labelCls}>Status</label>
            <select name="patientStatus" className={inputCls} defaultValue={p?.patientStatus || "ativo"}>
              <option value="ativo">Ativo</option>
              <option value="prospect">Prospect</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div><label className={labelCls}>Início</label><input name="startedAt" type="date" defaultValue={dateVal(p?.startedAt)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Endereço</label><input name="address" defaultValue={p?.address ?? ""} className={inputCls} placeholder="Endereço" /></div>
      </Section>

      {/* 2. Responsável */}
      <Section title="Dados do responsável">
        <p className="text-xs text-foreground/50 -mt-1">Para menores ou pacientes sob responsabilidade de terceiro.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Nome do responsável</label><input name="guardianName" defaultValue={p?.guardianName ?? ""} className={inputCls} placeholder="Nome completo" /></div>
          <div><label className={labelCls}>CPF do responsável</label><input name="guardianCpf" defaultValue={p?.guardianCpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
        </div>
      </Section>

      {/* 3. Emergência */}
      <Section title="Contato de emergência">
        <div className="grid sm:grid-cols-3 gap-4">
          <input name="emergencyName" defaultValue={p?.emergencyName ?? ""} placeholder="Nome" className={inputCls} />
          <input name="emergencyPhone" defaultValue={p?.emergencyPhone ?? ""} placeholder="Telefone" className={inputCls} />
          <input name="emergencyRelationship" defaultValue={p?.emergencyRelationship ?? ""} placeholder="Parentesco" className={inputCls} />
        </div>
      </Section>

      {/* 4. Atendimento e financeiro */}
      <Section title="Atendimento e financeiro">
        <AttendanceFields locations={locations} defaultMode={p?.attendanceMode ?? "presencial"} defaultLocation={p?.attendanceLocation ?? null} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dia de atendimento</label>
            <select name="attendanceDay" className={inputCls} defaultValue={p?.attendanceDay || ""}>
              <option value="">—</option>
              {DAYS.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Hora</label><input name="attendanceTime" type="time" defaultValue={p?.attendanceTime ?? ""} className={inputCls} /></div>
          <div><label className={labelCls}>Valor da sessão (R$)</label><input name="sessionFee" inputMode="decimal" defaultValue={p?.sessionFee ?? ""} className={inputCls} placeholder="ex: 200,00" /></div>
          <div>
            <label className={labelCls}>Recorrência<InfoTip text="Frequência do atendimento. Não vincula valor nem quantidade." /></label>
            <select name="frequency" className={inputCls} defaultValue={p?.frequency || "semanal"}>
              <option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Formato de pagamento</label>
            <select name="paymentFormat" className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="avulso">Avulso</option><option value="mensal">Mensal</option><option value="quinzenal">Quinzenal</option><option value="pacote">Pacote</option>
            </select>
          </div>
          {format === "pacote" && (
            <div><label className={labelCls}>Sessões no pacote</label><input name="sessionsInPacket" type="number" min={1} max={200} defaultValue={p?.sessionsInPacket ?? ""} className={inputCls} placeholder="ex: 8" /></div>
          )}
          <div><label className={labelCls}>Dia de pagamento</label><input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" /></div>
          <div><label className={labelCls}>Próximo reajuste<InfoTip text="Data prevista para revisar o valor." /></label><input name="priceReviewDate" type="date" defaultValue={dateVal(p?.priceReviewDate)} className={inputCls} /></div>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Lembrete de sessão<InfoTip text="Envia lembrete automático antes da sessão pelo canal escolhido (precisa do canal conectado em Ajustes)." /></p>
          <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
            <input type="checkbox" name="reminderEnabled" defaultChecked={p?.reminderEnabled} className="accent-primary w-4 h-4" /> Enviar lembrete automático antes da sessão
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Canal do lembrete</label>
              <select name="reminderChannel" className={inputCls} defaultValue={p?.reminderChannel || "whatsapp"}>
                <option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="telegram">Telegram</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Antecedência</label>
              <select name="reminderLeadMinutes" className={inputCls} defaultValue={p?.reminderLeadMinutes ?? 60}>
                {REMINDER_LEAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Fotos */}
      <Section title="Fotos">
        <PhotoSlots initial={{ photo3x4: p?.photo3x4 ?? null, photoExtra1: p?.photoExtra1 ?? null, photoExtra2: p?.photoExtra2 ?? null, photoExtra3: p?.photoExtra3 ?? null }} />
      </Section>

      <p className="text-xs text-foreground/50 px-1">💡 Etiquetas e observações ficam no <strong>Prontuário</strong> do paciente.</p>
    </div>
  );
}
