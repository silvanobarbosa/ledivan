import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Video, MapPin, CalendarCheck, Activity } from "lucide-react";
import Link from "next/link";
import { SESSION_STATUS_LABELS } from "@/lib/therapy";

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

  const rows = await db
    .select({ isOnline: therapySessions.isOnline, location: therapySessions.location, status: therapySessions.status })
    .from(therapySessions)
    .where(and(...conds));

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
