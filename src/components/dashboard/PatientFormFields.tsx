"use client";

import { useState, type ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import { MessageCircle } from "lucide-react";
import { AttendanceFields } from "@/components/dashboard/AttendanceFields";
import { PhotoSlots } from "@/components/dashboard/PhotoSlots";
import { REMINDER_LEAD_OPTIONS } from "@/lib/reminderLead";

const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";
const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export type PatientFormData = {
  name?: string; phone?: string | null; email?: string | null; patientStatus?: string;
  startedAt?: string | null; birthDate?: string | null; category?: string | null; cpf?: string | null; address?: string | null;
  guardianName?: string | null; guardianCpf?: string | null; guardianPhone?: string | null; guardianEmail?: string | null;
  emergencyName?: string | null; emergencyPhone?: string | null; emergencyEmail?: string | null; emergencyRelationship?: string | null;
  attendanceMode?: string | null; attendanceLocation?: string | null; attendanceDay?: string | null; attendanceTime?: string | null;
  sessionFee?: string | null; frequency?: string | null; paymentFormat?: string | null; sessionsInPacket?: number | null; paymentDay?: number | null; priceReviewDate?: string | null;
  reminderEnabled?: boolean; reminderChannel?: string | null; reminderLeadMinutes?: number | null;
  photo3x4?: string | null; photoExtra1?: string | null; photoExtra2?: string | null; photoExtra3?: string | null;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-card rounded-[24px] p-5 lg:p-6 space-y-4">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

// Campo de telefone com botão de WhatsApp (abre wa.me com o número digitado).
function PhoneInput({ name, defaultValue, label = "Telefone" }: { name: string; defaultValue?: string | null; label?: string }) {
  const [val, setVal] = useState(defaultValue ?? "");
  const open = () => {
    let d = val.replace(/\D/g, "");
    if (!d) return;
    if (d.length <= 11) d = "55" + d; // assume Brasil se sem DDI
    window.open(`https://wa.me/${d}`, "_blank");
  };
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input name={name} value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" />
        <button type="button" onClick={open} title="Enviar mensagem no WhatsApp" className="shrink-0 px-3 rounded-2xl bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition">
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { k: "dados", label: "Dados" },
  { k: "atendimento", label: "Atendimento" },
  { k: "financeiro", label: "Financeiro" },
  { k: "fotos", label: "Fotos" },
];

export function PatientFormFields({ p, locations }: { p?: PatientFormData; locations: { name: string; address: string }[] }) {
  const [tab, setTab] = useState("dados");
  const [format, setFormat] = useState(p?.paymentFormat || "avulso");
  const [lock, setLock] = useState("nao");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const show = (k: string) => (tab === k ? "space-y-4" : "hidden");

  return (
    <div className="space-y-5">
      {/* Submenu horizontal */}
      <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition ${tab === t.k ? "bg-primary text-white shadow" : "text-foreground/60 hover:bg-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DADOS: pessoais + responsável + emergência */}
      <div className={show("dados")}>
        <Card title="Dados pessoais">
          <div>
            <label className={labelCls}>Nome *</label>
            <input name="name" required defaultValue={p?.name ?? ""} className={inputCls} placeholder="Nome completo" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <PhoneInput name="phone" defaultValue={p?.phone} />
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
            <div><label className={labelCls}>Início</label><input name="startedAt" type="date" defaultValue={dateVal(p?.startedAt)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Endereço</label><input name="address" defaultValue={p?.address ?? ""} className={inputCls} placeholder="Endereço residencial" /></div>
        </Card>

        <Card title="Dados do responsável">
          <p className="text-xs text-foreground/50 -mt-1">Para menores ou pacientes sob responsabilidade de terceiro.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Nome do responsável</label><input name="guardianName" defaultValue={p?.guardianName ?? ""} className={inputCls} placeholder="Nome completo" /></div>
            <div><label className={labelCls}>CPF do responsável</label><input name="guardianCpf" defaultValue={p?.guardianCpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
            <PhoneInput name="guardianPhone" defaultValue={p?.guardianPhone} label="Telefone do responsável" />
            <div><label className={labelCls}>E-mail do responsável</label><input name="guardianEmail" type="email" defaultValue={p?.guardianEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
          </div>
        </Card>

        <Card title="Contato de emergência">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Nome</label><input name="emergencyName" defaultValue={p?.emergencyName ?? ""} className={inputCls} /></div>
            <div><label className={labelCls}>Parentesco</label><input name="emergencyRelationship" defaultValue={p?.emergencyRelationship ?? ""} className={inputCls} /></div>
            <PhoneInput name="emergencyPhone" defaultValue={p?.emergencyPhone} />
            <div><label className={labelCls}>E-mail</label><input name="emergencyEmail" type="email" defaultValue={p?.emergencyEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
          </div>
        </Card>
      </div>

      {/* ATENDIMENTO: modo + endereço + status + dia/hora + travar agenda + lembrete */}
      <div className={show("atendimento")}>
        <Card title="Atendimento">
          <AttendanceFields locations={locations} defaultMode={p?.attendanceMode ?? "presencial"} defaultLocation={p?.attendanceLocation ?? null} />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select name="patientStatus" className={inputCls} defaultValue={p?.patientStatus || "ativo"}>
                <option value="ativo">Ativo</option>
                <option value="prospect">Prospect</option>
                <option value="pausado">Pausado</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div></div>
            <div>
              <label className={labelCls}>Dia de atendimento</label>
              <select name="attendanceDay" className={inputCls} defaultValue={p?.attendanceDay || ""}>
                <option value="">—</option>
                {DAYS.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Hora</label><input name="attendanceTime" type="time" defaultValue={p?.attendanceTime ?? ""} className={inputCls} /></div>
          </div>

          {/* Travar agenda no dia/horário escolhido */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Travar agenda<InfoTip text="Gera sessões semanais no dia/horário escolhido, entre as datas. 'Agendada' = confirmada; 'Reservada' = aguardando confirmação." /></p>
            <div className="grid sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className={labelCls}>Travar como</label>
                <select name="lockAgenda" className={inputCls} value={lock} onChange={(e) => setLock(e.target.value)}>
                  <option value="nao">Não travar</option>
                  <option value="agendada">Agendada (confirmada)</option>
                  <option value="reservada">Reservada (a confirmar)</option>
                </select>
              </div>
              {lock !== "nao" && (
                <>
                  <div><label className={labelCls}>De</label><input name="lockStart" type="date" className={inputCls} /></div>
                  <div><label className={labelCls}>Até</label><input name="lockEnd" type="date" className={inputCls} /></div>
                </>
              )}
            </div>
            {lock !== "nao" && <p className="text-[11px] text-foreground/50 mt-2">Usa o <strong>dia</strong> e a <strong>hora</strong> escolhidos acima. Cria 1 sessão por semana no período.</p>}
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
        </Card>
      </div>

      {/* FINANCEIRO */}
      <div className={show("financeiro")}>
        <Card title="Financeiro">
          <div className="grid sm:grid-cols-2 gap-4">
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
        </Card>
      </div>

      {/* FOTOS */}
      <div className={show("fotos")}>
        <Card title="Fotos">
          <PhotoSlots initial={{ photo3x4: p?.photo3x4 ?? null, photoExtra1: p?.photoExtra1 ?? null, photoExtra2: p?.photoExtra2 ?? null, photoExtra3: p?.photoExtra3 ?? null }} />
        </Card>
      </div>

      <p className="text-xs text-foreground/50 px-1">💡 Etiquetas e observações ficam no <strong>Prontuário</strong> do paciente.</p>
    </div>
  );
}
