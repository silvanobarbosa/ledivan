import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, patients } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Video, MapPin, CalendarCheck, Activity, UserCheck, CalendarX, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { SESSION_STATUS_LABELS } from "@/lib/therapy";
import { AnaliticosCharts } from "./AnaliticosCharts";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; months: number | null }> = {
  "1m": { label: "Mês", months: 1 },
  "6m": { label: "6 meses", months: 6 },
  "12m": { label: "12 meses", months: 12 },
  all: { label: "Tudo", months: null },
};

export default async function AnaliticosPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { period, from, to } = await searchParams;
  const custom = period === "custom" && (from || to);
  const activePeriod = custom ? "custom" : period && PERIODS[period] ? period : "12m";
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // Janela de tempo: personalizada (from/to) ou um dos atalhos.
  let cutoff: Date | null = null;
  let end: Date | null = null;
  if (custom) {
    if (from) { cutoff = new Date(from); cutoff.setHours(0, 0, 0, 0); }
    if (to) { end = new Date(to); end.setHours(23, 59, 59, 999); }
  } else {
    const months = PERIODS[activePeriod].months;
    if (months) { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setMonth(cutoff.getMonth() - months); }
  }

  const conds = [eq(therapySessions.userId, userId)];
  if (cutoff) conds.push(gte(therapySessions.date, cutoff));
  if (end) conds.push(lte(therapySessions.date, end));

  const [rows, pats] = await Promise.all([
    db.select({ isOnline: therapySessions.isOnline, location: therapySessions.location, status: therapySessions.status, date: therapySessions.date })
      .from(therapySessions).where(and(...conds)),
    db.select({ status: patients.patientStatus, prospectDate: patients.prospectDate, prospectFechou: patients.prospectFechou, paymentStatus: patients.paymentStatus })
      .from(patients).where(eq(patients.userId, userId)),
  ]);

  // Prospecção: fechado x prospectado (prospectDate dentro da janela)
  const inWin = (d: Date | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    if (cutoff && t < cutoff.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  };
  const prospectados = pats.filter((p) => p.prospectDate && inWin(p.prospectDate as Date));
  const fechados = prospectados.filter((p) => p.status !== "prospect").length;
  const naoFechou = prospectados.filter((p) => p.status === "prospect" && (p.prospectFechou || "") === "Não fechou").length;
  const emAberto = prospectados.length - fechados - naoFechou;
  const taxaConv = prospectados.length ? Math.round((fechados / prospectados.length) * 100) : 0;

  // Atrasos em pagamento (snapshot atual)
  const atrasos = pats.filter((p) => p.paymentStatus === "overdue").length;

  // Faltas (não realizadas) e cancelamentos — por dia da semana e por mês
  const faltasRows = rows.filter((r) => r.status === "nao_realizada");
  const cancelados = rows.filter((r) => r.status === "cancelada").length;
  const faltasDow = [0, 0, 0, 0, 0, 0, 0];
  const faltasMonthMap = new Map<string, number>();
  for (const r of faltasRows) {
    const d = new Date(r.date as unknown as string);
    faltasDow[d.getDay()]++;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    faltasMonthMap.set(key, (faltasMonthMap.get(key) ?? 0) + 1);
  }

  // Considera atendimentos realizados
  const done = rows.filter((r) => r.status === "realizada");
  const total = done.length;
  const online = done.filter((r) => r.isOnline).length;
  const presencial = total - online;

  // Por local físico
  const byLocation = new Map<string, number>();
  for (const r of done) {
    if (r.isOnline) continue;
    const key = (r.location || "Sem local definido").trim() || "Sem local definido";
    byLocation.set(key, (byLocation.get(key) ?? 0) + 1);
  }
  const locList = [...byLocation.entries()].sort((a, b) => b[1] - a[1]);

  // Por status (todos no período)
  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const maxLoc = Math.max(1, ...locList.map(([, n]) => n));

  // Dados p/ gráficos: por mês, por dia da semana, modalidade
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthMap = new Map<string, number>();
  const dowArr = [0, 0, 0, 0, 0, 0, 0];
  for (const r of done) {
    const d = new Date(r.date as unknown as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
    dowArr[d.getDay()]++;
  }
  const chartMonthly = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => {
    const [y, m] = k.split("-");
    return { label: `${MES[parseInt(m) - 1]}/${y.slice(2)}`, count: v };
  });
  const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const chartWeekday = dowArr.map((v, i) => ({ label: DOW[i], count: v }));
  const chartMode = [
    { name: "Online", value: online },
    { name: "Presencial", value: presencial },
  ];
  const chartFaltasWeekday = faltasDow.map((v, i) => ({ label: DOW[i], count: v }));
  const maxFaltaDow = Math.max(1, ...faltasDow);
  const chartFaltasMonthly = [...faltasMonthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => {
    const [y, m] = k.split("-");
    return { label: `${MES[parseInt(m) - 1]}/${y.slice(2)}`, count: v };
  });
  const maxFaltaMonth = Math.max(1, ...chartFaltasMonthly.map((c) => c.count));

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
            <Activity className="w-7 h-7" /> Analíticos de atendimento
          </h1>
          <p className="text-foreground/50 mt-1">Gestão de atendimento — por local e modalidade. (O financeiro fica em Relatórios.)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PERIODS).map(([key, p]) => (
            <Link key={key} href={`/dashboard/analiticos?period=${key}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activePeriod === key ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"}`}>
              {p.label}
            </Link>
          ))}
          {/* Período personalizado */}
          <form method="get" className="flex items-center gap-1.5 rounded-full bg-white/60 px-2 py-1">
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={from || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
            <span className="text-xs text-foreground/40">→</span>
            <input type="date" name="to" defaultValue={to || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
            <button className={`px-3 py-1 rounded-full text-xs font-bold transition ${activePeriod === "custom" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>Aplicar</button>
          </form>
        </div>
      </div>

      {custom && (
        <p className="text-sm text-foreground/50">
          Período: {from ? new Date(from).toLocaleDateString("pt-BR") : "início"} até {to ? new Date(to).toLocaleDateString("pt-BR") : "hoje"}.
        </p>
      )}

      {/* Cards principais */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><CalendarCheck className="w-6 h-6" /></div>
          <div><p className="text-2xl font-display font-bold text-primary leading-none">{total}</p><p className="text-sm text-foreground/50 mt-1">Atendimentos realizados</p></div>
        </div>
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center"><Video className="w-6 h-6" /></div>
          <div><p className="text-2xl font-display font-bold text-primary leading-none">{online} <span className="text-sm font-normal text-foreground/40">({pct(online)}%)</span></p><p className="text-sm text-foreground/50 mt-1">Online</p></div>
        </div>
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#047857] flex items-center justify-center"><MapPin className="w-6 h-6" /></div>
          <div><p className="text-2xl font-display font-bold text-primary leading-none">{presencial} <span className="text-sm font-normal text-foreground/40">({pct(presencial)}%)</span></p><p className="text-sm text-foreground/50 mt-1">Presencial</p></div>
        </div>
      </div>

      {/* Gráficos */}
      <AnaliticosCharts monthly={chartMonthly} weekday={chartWeekday} mode={chartMode} />

      {/* Por local físico */}
      <div className="glass-card rounded-[32px] p-6 space-y-4">
        <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2"><MapPin className="w-5 h-5" /> Atendimentos por local</h2>
        {total === 0 ? (
          <p className="text-foreground/40 text-sm">Sem atendimentos realizados no período.</p>
        ) : (
          <div className="space-y-3">
            {/* Online como uma "linha" também */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><Video className="w-4 h-4 text-accent" /> Online</span><span className="font-bold text-primary">{online}</span></div>
              <div className="h-2.5 rounded-full bg-accent" style={{ width: `${(online / Math.max(maxLoc, online, 1)) * 100}%`, minWidth: online ? "8px" : 0 }} />
            </div>
            {locList.map(([loc, n]) => (
              <div key={loc} className="space-y-1">
                <div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#047857]" /> {loc}</span><span className="font-bold text-primary">{n}</span></div>
                <div className="h-2.5 rounded-full bg-[#047857]" style={{ width: `${(n / Math.max(maxLoc, online, 1)) * 100}%`, minWidth: "8px" }} />
              </div>
            ))}
            {locList.length === 0 && presencial === 0 && (
              <p className="text-foreground/40 text-sm">Nenhum atendimento presencial no período.</p>
            )}
          </div>
        )}
      </div>

      {/* Prospecção: fechado x prospectado */}
      <div className="glass-card rounded-[32px] p-6 space-y-4">
        <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2"><UserCheck className="w-5 h-5" /> Prospecção — fechado x prospectado</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-2xl font-display font-bold text-primary">{prospectados.length}</p><p className="text-xs text-foreground/50">Prospectados</p></div>
          <div className="rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] px-4 py-3"><p className="text-2xl font-display font-bold text-[#047857]">{fechados}</p><p className="text-xs text-foreground/50">Fechados</p></div>
          <div className="rounded-2xl bg-[#fffbeb] border border-[#fde68a] px-4 py-3"><p className="text-2xl font-display font-bold text-[#92400e]">{emAberto}</p><p className="text-xs text-foreground/50">Em aberto</p></div>
          <div className="rounded-2xl bg-primary/5 border border-border px-4 py-3"><p className="text-2xl font-display font-bold text-primary">{taxaConv}%</p><p className="text-xs text-foreground/50">Taxa de conversão</p></div>
        </div>
        {prospectados.length > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden bg-surface">
            <div className="bg-[#047857]" style={{ width: `${(fechados / prospectados.length) * 100}%` }} title={`Fechados: ${fechados}`} />
            <div className="bg-[#f59e0b]" style={{ width: `${(emAberto / prospectados.length) * 100}%` }} title={`Em aberto: ${emAberto}`} />
            <div className="bg-[#b91c1c]" style={{ width: `${(naoFechou / prospectados.length) * 100}%` }} title={`Não fechou: ${naoFechou}`} />
          </div>
        )}
        <p className="text-xs text-foreground/40">Verde = fechados · âmbar = em aberto · vermelho = não fechou ({naoFechou}).</p>
      </div>

      {/* Faltas */}
      <div className="glass-card rounded-[32px] p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2"><CalendarX className="w-5 h-5" /> Faltas (não realizadas)</h2>
          <span className="text-sm text-foreground/50">{faltasRows.length} falta(s) · {cancelados} cancelamento(s) no período</span>
        </div>
        <div>
          <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Por dia da semana</p>
          <div className="flex items-end gap-2 h-32">
            {chartFaltasWeekday.map((c) => (
              <div key={c.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                  <div className="w-full max-w-[34px] rounded-t-lg bg-[#ef4444]/80" style={{ height: `${(c.count / maxFaltaDow) * 100}%`, minHeight: c.count ? "4px" : 0 }} title={`${c.count}`} />
                </div>
                <span className="text-[11px] text-foreground/50">{c.label}</span>
                <span className="text-[10px] font-bold text-foreground/60">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
        {chartFaltasMonthly.length > 0 && (
          <div>
            <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Por mês</p>
            <div className="flex items-end gap-2 h-28 overflow-x-auto no-scrollbar">
              {chartFaltasMonthly.map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-1 min-w-[36px]">
                  <div className="flex-1 flex items-end" style={{ height: "100%" }}>
                    <div className="w-7 rounded-t-lg bg-[#ef4444]/60" style={{ height: `${(c.count / maxFaltaMonth) * 100}%`, minHeight: c.count ? "4px" : 0 }} />
                  </div>
                  <span className="text-[10px] text-foreground/50 whitespace-nowrap">{c.label}</span>
                  <span className="text-[10px] font-bold text-foreground/60">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Atrasos em pagamento */}
      <Link href="/dashboard/patients" className="glass-card rounded-[32px] p-6 flex items-center gap-4 hover:shadow-md transition">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${atrasos > 0 ? "bg-[#fef2f2] text-[#b91c1c]" : "bg-[#ecfdf5] text-[#047857]"}`}><AlertTriangle className="w-6 h-6" /></div>
        <div>
          <p className="text-2xl font-display font-bold text-primary leading-none">{atrasos}</p>
          <p className="text-sm text-foreground/50 mt-1">Paciente(s) com pagamento em atraso</p>
        </div>
      </Link>

      {/* Por status */}
      <div className="glass-card rounded-[32px] p-6 space-y-3">
        <h2 className="font-display text-xl font-bold text-primary">Por status (no período)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([st, n]) => (
            <div key={st} className="rounded-2xl bg-surface/60 border border-border px-4 py-3">
              <p className="text-xl font-display font-bold text-primary">{n}</p>
              <p className="text-xs text-foreground/50">{SESSION_STATUS_LABELS[st] ?? st}</p>
            </div>
          ))}
          {byStatus.size === 0 && <p className="text-foreground/40 text-sm">Sem dados.</p>}
        </div>
      </div>
    </div>
  );
}
