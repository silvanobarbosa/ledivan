"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";

const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

type P = {
  birthDate?: string | null; category?: string | null; cpf?: string | null;
  guardianName?: string | null; guardianCpf?: string | null;
  attendanceDay?: string | null; attendanceTime?: string | null;
  sessionFee?: string | null; frequency?: string | null; paymentFormat?: string | null;
  sessionsInPacket?: number | null; paymentDay?: number | null; priceReviewDate?: string | null;
};

const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export function CadastroFields({ p }: { p?: P }) {
  const [format, setFormat] = useState(p?.paymentFormat || "avulso");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <>
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Dados pessoais</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Data de nascimento</label>
            <input name="birthDate" type="date" defaultValue={dateVal(p?.birthDate)} className={inputCls} />
          </div>
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
          <div>
            <label className={labelCls}>CPF</label>
            <input name="cpf" defaultValue={p?.cpf ?? ""} className={inputCls} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Dia de atendimento</label>
              <select name="attendanceDay" className={inputCls} defaultValue={p?.attendanceDay || ""}>
                <option value="">—</option>
                {DAYS.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Hora</label>
              <input name="attendanceTime" type="time" defaultValue={p?.attendanceTime ?? ""} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelCls}>Nome do responsável<InfoTip text="Para menores ou pacientes sob responsabilidade de terceiro." /></label>
            <input name="guardianName" defaultValue={p?.guardianName ?? ""} className={inputCls} placeholder="Nome completo" />
          </div>
          <div>
            <label className={labelCls}>CPF do responsável</label>
            <input name="guardianCpf" defaultValue={p?.guardianCpf ?? ""} className={inputCls} placeholder="000.000.000-00" />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-3 mt-3">Financeiro</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Valor da sessão (R$)</label>
            <input name="sessionFee" inputMode="decimal" defaultValue={p?.sessionFee ?? ""} className={inputCls} placeholder="ex: 200,00" />
          </div>
          <div>
            <label className={labelCls}>Recorrência<InfoTip text="Frequência do atendimento. Não vincula valor nem quantidade." /></label>
            <select name="frequency" className={inputCls} defaultValue={p?.frequency || "semanal"}>
              <option value="semanal">Semanal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="mensal">Mensal</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Formato de pagamento</label>
            <select name="paymentFormat" className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="avulso">Avulso</option>
              <option value="mensal">Mensal</option>
              <option value="quinzenal">Quinzenal</option>
              <option value="pacote">Pacote</option>
            </select>
          </div>
          {format === "pacote" && (
            <div>
              <label className={labelCls}>Sessões no pacote</label>
              <input name="sessionsInPacket" type="number" min={1} max={200} defaultValue={p?.sessionsInPacket ?? ""} className={inputCls} placeholder="ex: 8" />
            </div>
          )}
          <div>
            <label className={labelCls}>Dia de pagamento</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
          </div>
          <div>
            <label className={labelCls}>Próximo reajuste<InfoTip text="Data prevista para revisar o valor. Aparece como alerta." /></label>
            <input name="priceReviewDate" type="date" defaultValue={dateVal(p?.priceReviewDate)} className={inputCls} />
          </div>
        </div>
      </div>
    </>
  );
}
