"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { queixaGroup } from "@/lib/queixas";

export type PanelPatient = {
  id: string; name: string; status: string;
  gender: string | null; birthDate: string | null; address: string | null;
  queixaPrincipal: string | null; paymentStatus: string | null;
  prospectDate: string | null; prospectFechou: string | null; startedAt: string | null;
};
export type PanelPresence = { patientId: string; presente: boolean; date: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ageOf = (birth: string | null): number | null => {
  if (!birth) return null;
  const b = new Date(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
const inRange = (iso: string | null, from: string, to: string): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from && t < new Date(from + "T00:00:00").getTime()) return false;
  if (to && t > new Date(to + "T23:59:59").getTime()) return false;
  return true;
};

const card = "glass-card rounded-[24px] p-5 space-y-4";
const inp = "px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm";
const lbl = "text-[11px] font-semibold uppercase tracking-wide text-foreground/40";

function Stat({ n, label, tone = "primary" }: { n: number | string; label: string; tone?: string }) {
  const c = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-primary";
  return <div className="text-center"><p className={`text-2xl font-display font-bold ${c}`}>{n}</p><p className="text-[11px] text-foreground/50">{label}</p></div>;
}

export function DashboardPanels({ patients, presence }: { patients: PanelPatient[]; presence: PanelPresence[] }) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40">Painéis</h3>
      <div className="grid lg:grid-cols-2 gap-4">
        <Prospeccao patients={patients} />
        <PacientesAtuais patients={patients} />
        <QueixaBloco patients={patients} />
        <Pagamentos patients={patients} />
        <Presenca patients={patients} presence={presence} />
      </div>
    </section>
  );
}

// 1. PROSPECÇÃO — filtro data (prospectDate) + fechado/não
function Prospeccao({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const base = patients.filter((p) => p.prospectDate && inRange(p.prospectDate, from, to));
  const fechados = base.filter((p) => p.status !== "prospect" || p.prospectFechou === "Fechou").length;
  const naoFechou = base.filter((p) => p.status === "prospect" && p.prospectFechou === "Não fechou").length;
  const emAberto = base.length - fechados - naoFechou;
  return (
    <div className={card}>
      <div className="flex items-center justify-between"><h4 className="font-display font-bold text-primary">Prospecção</h4><Link href="/dashboard/prospects" className="text-xs text-primary hover:underline">abrir →</Link></div>
      <div className="flex gap-2 flex-wrap"><div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div><div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div></div>
      <div className="grid grid-cols-4 gap-2"><Stat n={base.length} label="Prospectados" /><Stat n={fechados} label="Fechados" tone="green" /><Stat n={naoFechou} label="Não fechou" tone="red" /><Stat n={emAberto} label="Em aberto" tone="amber" /></div>
    </div>
  );
}

// 2. PACIENTES ATUAIS — filtro início + gênero + idade + cidade(endereço)
function PacientesAtuais({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [gender, setGender] = useState(""), [minA, setMinA] = useState(""), [maxA, setMaxA] = useState(""), [city, setCity] = useState("");
  const ativos = patients.filter((p) => p.status === "ativo");
  const filtered = ativos.filter((p) => {
    if ((from || to) && !inRange(p.startedAt, from, to)) return false;
    if (gender && (p.gender || "") !== gender) return false;
    const a = ageOf(p.birthDate);
    if (minA && (a === null || a < Number(minA))) return false;
    if (maxA && (a === null || a > Number(maxA))) return false;
    if (city && !norm(p.address || "").includes(norm(city))) return false;
    return true;
  });
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Pacientes atuais</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>Início de</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Gênero</span><select value={gender} onChange={(e) => setGender(e.target.value)} className={inp}><option value="">todos</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="nao-binario">Não-binário</option></select></div>
        <div><span className={lbl}>Idade</span><div className="flex gap-1"><input type="number" min={0} placeholder="mín" value={minA} onChange={(e) => setMinA(e.target.value)} className={`${inp} w-16`} /><input type="number" min={0} placeholder="máx" value={maxA} onChange={(e) => setMaxA(e.target.value)} className={`${inp} w-16`} /></div></div>
        <div><span className={lbl}>Cidade</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="no endereço" className={`${inp} w-28`} /></div>
      </div>
      <Stat n={filtered.length} label="pacientes ativos no filtro" />
    </div>
  );
}

// 3. QUEIXA PRINCIPAL — filtro tipo + data (início)
function QueixaBloco({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [tipo, setTipo] = useState("");
  const base = patients.filter((p) => p.status !== "prospect" && ((from || to) ? inRange(p.startedAt, from, to) : true));
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of base) { const g = queixaGroup(p.queixaPrincipal); if (g === "—") continue; m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);
  const shown = tipo ? groups.filter((g) => g[0] === tipo) : groups;
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Queixa principal</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}><option value="">todos</option>{groups.map((g) => <option key={g[0]} value={g[0]}>{g[0]}</option>)}</select></div>
      </div>
      {shown.length === 0 ? <p className="text-sm text-foreground/40">Sem dados.</p> : (
        <div className="space-y-1.5">{shown.map((g) => (<div key={g[0]} className="flex items-center gap-2"><span className="text-sm text-foreground/70 w-40 truncate">{g[0]}</span><div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden"><div className="h-2 bg-primary" style={{ width: `${(g[1] / Math.max(...groups.map((x) => x[1]))) * 100}%` }} /></div><span className="text-sm font-bold text-primary w-8 text-right">{g[1]}</span></div>))}</div>
      )}
    </div>
  );
}

// 4. PAGAMENTOS — atraso/em dia (+ link previsão)
function Pagamentos({ patients }: { patients: PanelPatient[] }) {
  const ativos = patients.filter((p) => p.status !== "prospect");
  const atraso = ativos.filter((p) => p.paymentStatus === "overdue").length;
  const emDia = ativos.filter((p) => p.paymentStatus !== "overdue").length;
  return (
    <div className={card}>
      <div className="flex items-center justify-between"><h4 className="font-display font-bold text-primary">Pagamentos</h4><Link href="/dashboard/previsao" className="text-xs text-primary hover:underline">previsão futura →</Link></div>
      <div className="grid grid-cols-2 gap-2"><Stat n={atraso} label="Em atraso" tone="red" /><Stat n={emDia} label="Em dia" tone="green" /></div>
      <div className="flex gap-2"><Link href="/dashboard/financeiro" className="text-xs text-primary hover:underline">financeiro →</Link><Link href="/dashboard/visao-financeira" className="text-xs text-primary hover:underline">saldos por paciente →</Link></div>
    </div>
  );
}

// 5. PRESENÇA — faltas/presenças, filtro data + idade
function Presenca({ patients, presence }: { patients: PanelPatient[]; presence: PanelPresence[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [minA, setMinA] = useState(""), [maxA, setMaxA] = useState("");
  const ageById = useMemo(() => new Map(patients.map((p) => [p.id, ageOf(p.birthDate)])), [patients]);
  const rows = presence.filter((r) => {
    if ((from || to) && !inRange(r.date, from, to)) return false;
    const a = ageById.get(r.patientId) ?? null;
    if (minA && (a === null || a < Number(minA))) return false;
    if (maxA && (a === null || a > Number(maxA))) return false;
    return true;
  });
  const presencas = rows.filter((r) => r.presente).length;
  const faltas = rows.length - presencas;
  const taxa = rows.length ? Math.round((presencas / rows.length) * 100) : 0;
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Presença</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Idade</span><div className="flex gap-1"><input type="number" min={0} placeholder="mín" value={minA} onChange={(e) => setMinA(e.target.value)} className={`${inp} w-16`} /><input type="number" min={0} placeholder="máx" value={maxA} onChange={(e) => setMaxA(e.target.value)} className={`${inp} w-16`} /></div></div>
      </div>
      <div className="grid grid-cols-3 gap-2"><Stat n={presencas} label="Presenças" tone="green" /><Stat n={faltas} label="Faltas" tone="red" /><Stat n={`${taxa}%`} label="Comparecimento" /></div>
    </div>
  );
}
