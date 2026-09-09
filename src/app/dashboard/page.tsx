import { db } from "@/db";
import { auth } from "@/auth";
import { users, patients, therapySessions, patientPackages } from "@/db/schema";
import { and, eq, gte, lte, sql, count, inArray } from "drizzle-orm";
import { formatDateTime } from "@/lib/therapy";
import { Users as UsersIcon, CalendarCheck, Clock, ChevronRight, Video, MapPin, AlertTriangle } from "lucide-react";
import { AnaliticosCharts } from "@/components/dashboard/AnaliticosCharts";
import { DashboardPanels } from "@/components/dashboard/DashboardPanels";
import { AnalyticsFilters } from "@/components/dashboard/AnalyticsFilters";
import Link from "next/link";
import { cookies } from "next/headers";
import { DEMO_DATA } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; months: number | null }> = {
  "1m": { label: "Mês", months: 1 },
  "6m": { label: "6 meses", months: 6 },
  "12m": { label: "12 meses", months: 12 },
  all: { label: "Tudo", months: null },
};
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; demo?: string }> }) {
  const { period, from, to, demo } = await searchParams;

  // Verificar se é modo demo
  const cookieStore = await cookies();
  const isDemo = cookieStore.get('is-demo')?.value === 'true' || demo === 'true';

  // Se for modo demo, usar dados fictícios
  if (isDemo) {
    return renderDemoDashboard({ period, from, to });
  }

  // Caso contrário, continuar com fluxo normal
  const session = await auth();
  if (!session?.user?.id) return <div>Você precisa estar logado para acessar o dashboard.</div>;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return <div>Usuário não encontrado.</div>;
  const userId = user.id;

  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const now = new Date();
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  // Janela do dia para o bloco "Sessões do dia": começa à meia-noite, não em `now`. Sessão das
  // 9h ainda é sessão do dia às 15h — o terapeuta precisa ver o dia inteiro, não só o que sobrou.
  const diaInicio = new Date(todayStart);
  const diaFim = new Date(todayStart + 24 * 60 * 60 * 1000);

  // Janela dos analíticos
  const custom = period === "custom" && (from || to);
  const activePeriod = custom ? "custom" : period && PERIODS[period] ? period : "12m";
  let cutoff: Date | null = null, end: Date | null = null;
  if (custom) {
    if (from) { cutoff = new Date(from); cutoff.setHours(0, 0, 0, 0); }
    if (to) { end = new Date(to); end.setHours(23, 59, 59, 999); }
  } else {
    const months = PERIODS[activePeriod].months;
    if (months) { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setMonth(cutoff.getMonth() - months); }
  }
  const anConds = [eq(therapySessions.userId, userId)];
  if (cutoff) anConds.push(gte(therapySessions.date, cutoff));
  if (end) anConds.push(lte(therapySessions.date, end));

  const [activeRows, weekRows, sessoesDoDia, reservasRows, pkgEndingRows, anRows, pats, pkgRealizedRows] = await Promise.all([
    db.select({ val: count() }).from(patients).where(and(eq(patients.userId, userId), eq(patients.patientStatus, "ativo"))),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${userId} AND ${therapySessions.date} >= ${weekStart} AND ${therapySessions.date} < ${weekEnd}`),
    db.query.therapySessions.findMany({
      where: sql`${therapySessions.userId} = ${userId} AND ${therapySessions.date} >= ${diaInicio} AND ${therapySessions.date} < ${diaFim} AND ${therapySessions.status} = 'agendada' AND ${therapySessions.pendingConfirmation} = false`,
      with: { patient: { columns: { name: true, id: true } } }, orderBy: [therapySessions.date],
    }),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${userId} AND ${therapySessions.date} >= ${now} AND ${therapySessions.pendingConfirmation} = true`),
    db.select({ pid: patientPackages.patientId, total: sql<number>`sum(${patientPackages.sessions})::int` })
      .from(patientPackages).innerJoin(patients, eq(patientPackages.patientId, patients.id))
      .where(and(eq(patientPackages.userId, userId), eq(patients.patientStatus, "ativo"), eq(patients.contractType, "pacote"))).groupBy(patientPackages.patientId),
    db.select({ isOnline: therapySessions.isOnline, location: therapySessions.location, status: therapySessions.status, date: therapySessions.date }).from(therapySessions).where(and(...anConds)),
    db.select({ id: patients.id, name: patients.name, status: patients.patientStatus, prospectDate: patients.prospectDate, prospectFechou: patients.prospectFechou, paymentStatus: patients.paymentStatus, gender: patients.gender, birthDate: patients.birthDate, address: patients.address, phone: patients.phone, email: patients.email, queixaPrincipal: patients.queixaPrincipal, startedAt: patients.startedAt }).from(patients).where(eq(patients.userId, userId)),
    // Consumo de pacote = fonte única DERIVADA: sessões realizadas+cobráveis por paciente.
    db.select({ pid: therapySessions.patientId, cnt: sql<number>`count(*)::int` })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"), eq(therapySessions.chargeable, true))).groupBy(therapySessions.patientId),
  ]);
  const pkgRealizedMap = new Map(pkgRealizedRows.map((r) => [r.pid, Number(r.cnt)]));

  // Presença dos últimos 24 meses (para o bloco Presença: filtro por data/idade).
  const presStart = new Date(); presStart.setMonth(presStart.getMonth() - 24);
  const presenceRows = await db.select({ patientId: therapySessions.patientId, status: therapySessions.status, date: therapySessions.date })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, presStart), inArray(therapySessions.status, ["realizada", "nao_realizada"])));
  const panelPatients = pats.map((p) => ({
    id: p.id, name: p.name, status: p.status,
    gender: p.gender, birthDate: p.birthDate ? (p.birthDate as unknown as string) : null,
    address: p.address, phone: p.phone, email: p.email,
    queixaPrincipal: p.queixaPrincipal, paymentStatus: p.paymentStatus,
    prospectDate: p.prospectDate ? (p.prospectDate as unknown as string) : null, prospectFechou: p.prospectFechou,
    startedAt: p.startedAt ? (p.startedAt as unknown as string) : null,
  }));
  const panelPresence = presenceRows.map((r) => ({ patientId: r.patientId, presente: r.status === "realizada", date: r.date as unknown as string }));

  const activePatients = Number(activeRows[0]?.val || 0);
  const weekSessions = Number(weekRows[0]?.val || 0);
  const reservasCount = Number(reservasRows[0]?.val || 0);
  const pacotesAcabando = pkgEndingRows.filter((r) => (Number(r.total) - (pkgRealizedMap.get(r.pid) ?? 0)) === 1).length;

  // ---- Analíticos ----
  const done = anRows.filter((r) => r.status === "realizada");
  const total = done.length;
  const online = done.filter((r) => r.isOnline).length;
  const presencial = total - online;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const byLocation = new Map<string, number>();
  for (const r of done) { if (r.isOnline) continue; const k = (r.location || "Sem local definido").trim() || "Sem local definido"; byLocation.set(k, (byLocation.get(k) ?? 0) + 1); }
  const locList = [...byLocation.entries()].sort((a, b) => b[1] - a[1]);
  const maxLoc = Math.max(1, ...locList.map(([, n]) => n));

  const monthMap = new Map<string, number>();
  const dowArr = [0, 0, 0, 0, 0, 0, 0];
  for (const r of done) { const d = new Date(r.date as unknown as string); monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, (monthMap.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`) ?? 0) + 1); dowArr[d.getDay()]++; }
  const chartMonthly = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => { const [y, m] = k.split("-"); return { label: `${MES[parseInt(m) - 1]}/${y.slice(2)}`, count: v }; });
  const chartWeekday = dowArr.map((v, i) => ({ label: DOW[i], count: v }));
  const chartMode = [{ name: "Online", value: online }, { name: "Presencial", value: presencial }];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <section className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-[#ede4fb] px-3 py-1.5 rounded-full mb-2">🌿 Atendimento</div>
        <h2 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">Olá, {(user.name || "Terapeuta").split(" ")[0]}!</h2>
        <p className="text-foreground/40 font-medium">Resumo do seu consultório e analíticos de atendimento.</p>
      </section>

      <DashboardPanels patients={panelPatients} presence={panelPresence} mensagemAniversario={user.birthdayMessage ?? ""} corteSemana={new Date(todayStart - 6 * 24 * 60 * 60 * 1000).toISOString()} hoje={`${diaInicio.getFullYear()}-${String(diaInicio.getMonth() + 1).padStart(2, "0")}-${String(diaInicio.getDate()).padStart(2, "0")}`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/patients?status=ativo" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><UsersIcon className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{activePatients}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Pacientes ativos <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
        <Link href="/dashboard/agenda" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><CalendarCheck className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{weekSessions}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Sessões na semana <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
      </div>

      {(reservasCount > 0 || pacotesAcabando > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {reservasCount > 0 && (
            <Link href="/dashboard/reservas" className="flex items-center gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-[28px] p-5 hover:shadow-md transition group">
              <div className="w-12 h-12 rounded-2xl bg-[#fef3c7] text-[#92400e] flex items-center justify-center text-xl shrink-0">⏳</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-[#92400e]">{reservasCount} reserva(s) a confirmar</p><p className="text-sm text-[#92400e]/70">Aguardando confirmação.</p></div>
              <ChevronRight className="w-5 h-5 text-[#92400e]/50 group-hover:translate-x-1 transition shrink-0" />
            </Link>
          )}
          {pacotesAcabando > 0 && (
            <Link href="/dashboard/pacotes-acabando" className="flex items-center gap-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-[28px] p-5 hover:shadow-md transition group">
              <div className="w-12 h-12 rounded-2xl bg-[#dbeafe] text-[#1e40af] flex items-center justify-center text-xl shrink-0">📦</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-[#1e40af]">{pacotesAcabando} com pacote acabando</p><p className="text-sm text-[#1e40af]/70">Resta 1 sessão — renovar.</p></div>
              <ChevronRight className="w-5 h-5 text-[#1e40af]/50 group-hover:translate-x-1 transition shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Sessões do dia */}
      <div className="bg-white rounded-[28px] border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2"><Clock className="w-5 h-5" /> Sessões do dia</h3>
          <Link href="/dashboard/agenda" className="text-sm font-semibold text-accent hover:underline">Ver agenda</Link>
        </div>
        {sessoesDoDia.length === 0 ? (
          <p className="text-foreground/40 text-sm">Nenhuma sessão agendada para hoje.</p>
        ) : (
          <div className="grid gap-2">
            {sessoesDoDia.map((s) => {
              const past = new Date(s.date as unknown as string).getTime() < todayStart;
              const Row = (<>
                <span className="font-mono text-sm font-semibold text-primary shrink-0">{formatDateTime(s.date as unknown as string)}</span>
                <span className="flex-1 font-medium truncate">{s.patient?.name ?? "—"}</span>
                <span className="text-xs text-foreground/40">{s.duration}min</span>
                {!past && <span className="text-[11px] font-bold text-accent opacity-0 group-hover:opacity-100 transition">Atender →</span>}
              </>);
              return past
                ? <div key={s.id} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3">{Row}</div>
                : <Link key={s.id} href={`/atender/${s.id}`} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition group">{Row}</Link>;
            })}
          </div>
        )}
      </div>

      {/* ===== Analíticos de atendimento ===== */}
      <div className="space-y-6 pt-2">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-2xl font-display font-bold text-primary">Analíticos de atendimento</h3>
          </div>
          <AnalyticsFilters activePeriod={activePeriod} from={from} to={to} />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-[28px] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><CalendarCheck className="w-6 h-6" /></div><div><p className="text-2xl font-display font-bold text-primary leading-none">{total}</p><p className="text-sm text-foreground/50 mt-1">Atendimentos realizados</p></div></div>
          <div className="glass-card rounded-[28px] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center"><Video className="w-6 h-6" /></div><div><p className="text-2xl font-display font-bold text-primary leading-none">{online} <span className="text-sm font-normal text-foreground/40">({pct(online)}%)</span></p><p className="text-sm text-foreground/50 mt-1">Online</p></div></div>
          <div className="glass-card rounded-[28px] p-6 flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#047857] flex items-center justify-center"><MapPin className="w-6 h-6" /></div><div><p className="text-2xl font-display font-bold text-primary leading-none">{presencial} <span className="text-sm font-normal text-foreground/40">({pct(presencial)}%)</span></p><p className="text-sm text-foreground/50 mt-1">Presencial</p></div></div>
        </div>

        <AnaliticosCharts monthly={chartMonthly} weekday={chartWeekday} mode={chartMode} />

        {/* Por local */}
        <div className="glass-card rounded-[28px] p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2"><MapPin className="w-5 h-5" /> Atendimentos por local</h3>
          {total === 0 ? <p className="text-foreground/40 text-sm">Sem atendimentos no período.</p> : (
            <div className="space-y-3">
              <div className="space-y-1"><div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><Video className="w-4 h-4 text-accent" /> Online</span><span className="font-bold text-primary">{online}</span></div><div className="h-2.5 rounded-full bg-accent" style={{ width: `${(online / Math.max(maxLoc, online, 1)) * 100}%`, minWidth: online ? "8px" : 0 }} /></div>
              {locList.map(([loc, n]) => (<div key={loc} className="space-y-1"><div className="flex justify-between text-sm"><span className="font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#047857]" /> {loc}</span><span className="font-bold text-primary">{n}</span></div><div className="h-2.5 rounded-full bg-[#047857]" style={{ width: `${(n / Math.max(maxLoc, online, 1)) * 100}%`, minWidth: "8px" }} /></div>))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Função para renderizar dashboard demo com dados fictícios
function renderDemoDashboard({ period: _period, from: _from, to: _to }: { period?: string; from?: string; to?: string }) {
  return (
    <div className="space-y-6">
      {/* Banner de Modo Demo */}
      <div className="glass-card rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Modo Demonstração</p>
            <p className="text-sm text-amber-700 dark:text-amber-200">
              Você está explorando o Ledivan com dados fictícios. As alterações não serão salvas.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div>
        <p className="text-foreground/50 font-display text-lg mb-2">🌿 Atendimento</p>
        <h2 className="text-4xl font-display font-bold text-primary">Olá, Usuário Demo!</h2>
        <p className="text-foreground/60 mt-1">Explore todas as funcionalidades com dados de exemplo.</p>
      </div>

      {/* Métricas */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/dashboard/patients?status=ativo" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] flex items-center justify-center text-[#047857]">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-display font-bold text-primary leading-none">{DEMO_DATA.analytics.activePatients}</p>
            <p className="text-sm text-foreground/50 mt-1">Pacientes ativos <ChevronRight className="w-3 h-3 inline-block" /></p>
          </div>
        </Link>
        <Link href="/dashboard/agenda" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-2xl bg-[#fef3c7] flex items-center justify-center text-[#b45309]">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-display font-bold text-primary leading-none">{DEMO_DATA.analytics.weekSessions}</p>
            <p className="text-sm text-foreground/50 mt-1">Sessões na semana <ChevronRight className="w-3 h-3 inline-block" /></p>
          </div>
        </Link>
      </div>

      {/* Próximas sessões */}
      <div className="glass-card rounded-[28px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-primary">
            <CalendarCheck className="w-5 h-5 inline-block mr-2" />
            Próximas sessões (exemplo)
          </h3>
          <Link href="/dashboard/agenda" className="text-sm text-primary hover:underline">Ver agenda</Link>
        </div>
        <div className="space-y-2">
          {DEMO_DATA.sessions.slice(0, 3).map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-surface/60 border border-border">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-foreground/50">{new Date(session.date).toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                  <p className="text-lg font-bold text-primary">{session.time}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">{session.patientName}</p>
                  <p className="text-xs text-foreground/50">{session.type === 'online' ? '🎥 Online' : '📍 Presencial'}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${session.status === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {session.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics simplificados */}
      <div className="glass-card rounded-[28px] p-6">
        <h3 className="font-display text-lg font-bold text-primary mb-4">Analíticos de atendimento</h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-[20px] p-4">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-2xl font-display font-bold text-primary">{DEMO_DATA.analytics.completionRate}%</p>
            <p className="text-xs text-foreground/50">Taxa de conclusão</p>
          </div>
          <div className="glass-card rounded-[20px] p-4">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
              <Video className="w-4 h-4" />
            </div>
            <p className="text-2xl font-display font-bold text-primary">60%</p>
            <p className="text-xs text-foreground/50">Online</p>
          </div>
          <div className="glass-card rounded-[20px] p-4">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center text-green-600 mb-3">
              <MapPin className="w-4 h-4" />
            </div>
            <p className="text-2xl font-display font-bold text-primary">40%</p>
            <p className="text-xs text-foreground/50">Presencial</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-surface/60 border border-border">
          <p className="text-sm text-foreground/50 mb-2">Receita vs Despesas (últimos 30 dias)</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-600">Receitas</span>
                <span className="font-semibold">R$ {DEMO_DATA.analytics.monthRevenue.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '70%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-600">Despesas</span>
                <span className="font-semibold">R$ {DEMO_DATA.analytics.monthExpenses.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: '30%' }}></div>
              </div>
            </div>
          </div>
          <p className="text-sm text-foreground/50 mt-3 text-center">
            Saldo: <span className="font-semibold text-green-600">
              R$ {(DEMO_DATA.analytics.monthRevenue - DEMO_DATA.analytics.monthExpenses).toFixed(2)}
            </span>
          </p>
        </div>
      </div>

      {/* Call to Action */}
      <div className="glass-card rounded-[28px] p-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <h3 className="font-display text-lg font-bold text-primary mb-2">Pronto para começar?</h3>
        <p className="text-sm text-foreground/60 mb-4">
          Crie sua conta e comece a organizar seu consultório hoje mesmo.
        </p>
        <Link href="/login" className="btn btn-primary">
          Criar minha conta →
        </Link>
      </div>
    </div>
  );
}
