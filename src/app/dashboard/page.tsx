import { db } from "@/db";
import { auth } from "@/auth";
import { users, transactions, goals, categories, achievements, patients, therapySessions, patientPackages } from "@/db/schema";
import { eq, sum, desc, sql, count, and } from "drizzle-orm";
import { formatBRL, formatDateTime } from "@/lib/therapy";
import { Users as UsersIcon, CalendarCheck, Clock, ChevronRight } from "lucide-react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { CapiInsights } from "@/components/dashboard/CapiInsights";
import { Achievements } from "@/components/dashboard/Achievements";
import { CapiMascot } from "@/components/dashboard/CapiMascot";
import { TransactionsChart } from "@/components/dashboard/TransactionsChart";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return <div>Você precisa estar logado para acessar o dashboard.</div>;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  });
  
  if (!user) {
    return <div>Usuário não encontrado no banco de dados.</div>;
  }

  // Datas de janela
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = new Date(); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(1);
  const now = new Date();
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();

  // Todas as consultas do dashboard em paralelo (evita waterfall no Neon)
  const [
    balanceRows, recentTransactionsData, userGoals, userAchievementsData, tCountRows,
    chartData, categoryDistribution, activeRows, weekRows, sessionIncomeRows,
    upcomingSessions, reservasRows, pkgEndingRows, analiticosRows,
  ] = await Promise.all([
    db.select({
      total: sum(transactions.amount),
      income: sql<string>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end)`,
      expense: sql<string>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end)`,
    }).from(transactions).where(eq(transactions.userId, user.id)),
    db.query.transactions.findMany({ where: eq(transactions.userId, user.id), with: { category: true }, orderBy: [desc(transactions.date)], limit: 5 }),
    db.query.goals.findMany({ where: eq(goals.userId, user.id), limit: 1 }),
    db.query.achievements.findMany({ where: eq(achievements.userId, user.id) }),
    db.select({ val: count() }).from(transactions).where(eq(transactions.userId, user.id)),
    db.select({ date: sql<string>`TO_CHAR(${transactions.date}, 'DD/MM')`, total: sum(transactions.amount) })
      .from(transactions)
      .where(sql`${transactions.userId} = ${user.id} AND ${transactions.date} >= ${thirtyDaysAgo}`)
      .groupBy(sql`TO_CHAR(${transactions.date}, 'DD/MM'), ${transactions.date}`)
      .orderBy(transactions.date),
    db.select({ name: categories.name, value: sum(transactions.amount), color: categories.color })
      .from(transactions).innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, user.id)).groupBy(categories.name, categories.color),
    db.select({ val: count() }).from(patients).where(and(eq(patients.userId, user.id), eq(patients.patientStatus, "ativo"))),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${weekStart} AND ${therapySessions.date} < ${weekEnd}`),
    db.select({ val: sum(transactions.amount) }).from(transactions).where(sql`${transactions.userId} = ${user.id} AND ${transactions.source} = 'session_payment' AND ${transactions.date} >= ${monthStart}`),
    db.query.therapySessions.findMany({
      where: sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${now} AND ${therapySessions.status} = 'agendada' AND ${therapySessions.pendingConfirmation} = false`,
      with: { patient: { columns: { name: true, id: true } } },
      orderBy: [therapySessions.date],
      limit: 5,
    }),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${now} AND ${therapySessions.pendingConfirmation} = true`),
    db.select({ pid: patientPackages.patientId, rem: sql<number>`sum(${patientPackages.sessions} - ${patientPackages.used})::int` })
      .from(patientPackages).innerJoin(patients, eq(patientPackages.patientId, patients.id))
      .where(and(eq(patientPackages.userId, user.id), eq(patients.patientStatus, "ativo"), eq(patients.contractType, "pacote")))
      .groupBy(patientPackages.patientId),
    db.select({ status: therapySessions.status, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${ninetyDaysAgo} AND ${therapySessions.date} <= ${now}`),
  ]);
  const reservasCount = Number(reservasRows[0]?.val || 0);
  const pacotesAcabando = pkgEndingRows.filter((r) => Number(r.rem) === 1).length;

  // Analíticos (90 dias) p/ o dashboard
  const an = analiticosRows;
  const anRealizados = an.filter((r) => r.status === "realizada");
  const anTotal = anRealizados.length;
  const anOnline = anRealizados.filter((r) => r.isOnline).length;
  const anPresencial = anTotal - anOnline;
  const anFaltas = an.filter((r) => r.status === "nao_realizada").length;
  const anCancel = an.filter((r) => r.status === "cancelada").length;
  const anPct = (n: number) => (anTotal ? Math.round((n / anTotal) * 100) : 0);

  const totalBalance = parseFloat(balanceRows[0]?.total || "0");
  const totalIncome = parseFloat(balanceRows[0]?.income || "0");
  const totalExpense = parseFloat(balanceRows[0]?.expense || "0");
  const totalTransactionsCount = Number(tCountRows[0]?.val || 0);
  const xp = (totalTransactionsCount * 10) + (userAchievementsData.length * 100);
  const level = 1 + Math.floor(xp / 500);
  const currentLevelXp = xp % 500;
  const activePatients = Number(activeRows[0]?.val || 0);
  const weekSessions = Number(weekRows[0]?.val || 0);
  const sessionIncomeMonth = parseFloat(sessionIncomeRows[0]?.val || "0");

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">
          Olá, {(user.name || 'Terapeuta').split(' ')[0]}!
        </h2>
        <p className="text-lg text-foreground/40 font-medium">
          Resumo do consultório e das suas finanças hoje.
        </p>
      </section>

      {/* ===================== ÁREA TERAPÊUTICA ===================== */}
      <section className="rounded-[36px] border border-[#e4d9f2] bg-[#f7f2fc] p-5 lg:p-8 space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-[#ede4fb] px-3 py-1.5 rounded-full">🌿 Atendimento</div>

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

        {/* Próximas sessões */}
        <div className="bg-white rounded-[28px] border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2"><Clock className="w-5 h-5" /> Próximas sessões</h3>
            <Link href="/dashboard/agenda" className="text-sm font-semibold text-accent hover:underline">Ver agenda</Link>
          </div>
          {upcomingSessions.length === 0 ? (
            <p className="text-foreground/40 text-sm">Nenhuma sessão agendada.</p>
          ) : (
            <div className="grid gap-2">
              {upcomingSessions.map((s) => {
                const past = new Date(s.date as unknown as string).getTime() < todayStart;
                const Row = (
                  <>
                    <span className="font-mono text-sm font-semibold text-primary shrink-0">{formatDateTime(s.date as unknown as string)}</span>
                    <span className="flex-1 font-medium truncate">{s.patient?.name ?? "—"}</span>
                    <span className="text-xs text-foreground/40">{s.duration}min</span>
                    {!past && <span className="text-[11px] font-bold text-accent opacity-0 group-hover:opacity-100 transition">Atender →</span>}
                  </>
                );
                return past
                  ? <div key={s.id} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3">{Row}</div>
                  : <Link key={s.id} href={`/atender/${s.id}`} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition group">{Row}</Link>;
              })}
            </div>
          )}
        </div>

        {/* Analíticos (90 dias) */}
        <div className="bg-white rounded-[28px] border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold text-primary">Analíticos · últimos 90 dias</h3>
            <Link href="/dashboard/analiticos" className="text-sm font-semibold text-accent hover:underline">Ver tudo</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-primary">{anTotal}</p><p className="text-xs text-foreground/50">Realizados</p></div>
            <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-accent">{anOnline} <span className="text-xs font-normal text-foreground/40">({anPct(anOnline)}%)</span></p><p className="text-xs text-foreground/50">Online</p></div>
            <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-[#047857]">{anPresencial} <span className="text-xs font-normal text-foreground/40">({anPct(anPresencial)}%)</span></p><p className="text-xs text-foreground/50">Presencial</p></div>
            <div className="rounded-2xl bg-[#fef2f2] border border-[#fecaca] px-4 py-3"><p className="text-xl font-display font-bold text-[#b91c1c]">{anFaltas}</p><p className="text-xs text-foreground/50">Faltas{anCancel ? ` · ${anCancel} canc.` : ""}</p></div>
          </div>
        </div>
      </section>

      {/* ===================== ÁREA FINANCEIRA ===================== */}
      <section className="rounded-[36px] border border-[#bfe3da] bg-[#eaf6f2] p-5 lg:p-8 space-y-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f766e] bg-[#ccfbef] px-3 py-1.5 rounded-full">💼 Financeiro</div>

        <Link href="/dashboard/reports" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.01] transition group w-full sm:w-auto sm:inline-flex">
          <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#047857] flex items-center justify-center font-bold shrink-0">R$</div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none break-words">{formatBRL(sessionIncomeMonth)}</p><p className="text-sm text-foreground/50 mt-1">Receita de sessões (mês)</p></div>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BalanceCard title="Saldo Total" amount={totalBalance} trend="+ R$ 0,00 este mês" icon={<Wallet className="w-6 h-6" />} variant="primary" />
          <BalanceCard title="Receitas" amount={totalIncome} trend="Baseado em dados reais" icon={<ArrowUpRight className="w-6 h-6" />} variant="secondary" />
          <BalanceCard title="Despesas" amount={totalExpense} trend="Despesas do período" icon={<ArrowDownRight className="w-6 h-6" />} variant="white" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="p-8 bg-white rounded-[36px] border border-border min-h-[400px] relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div><h3 className="text-xl font-display font-bold text-primary">Evolução patrimonial</h3><p className="text-sm text-foreground/40">Dados reais do banco</p></div>
                <div className="flex-1 flex items-center justify-center py-8"><TransactionsChart data={chartData} /></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-surface to-white pointer-events-none" />
            </div>
            <RecentTransactions transactions={recentTransactionsData} />
          </div>

          <div className="space-y-8">
            <CapiMascot level={level} xp={currentLevelXp} nextLevelXp={500} message={userAchievementsData.length > 0 ? "Bom trabalho! Sua gestão está evoluindo." : "Comece registrando pacientes e sessões."} />
            <CapiInsights categoryData={categoryDistribution} userId={user.id} />
            <Achievements userAchievements={userAchievementsData} />
            {userGoals.length > 0 && (
              <div className="p-8 bg-primary rounded-[40px] text-white shadow-xl shadow-primary/20 space-y-6">
                <h4 className="font-bold text-lg">Meta: {userGoals[0].title}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium"><span>Progresso</span><span>{Math.round((parseFloat(userGoals[0].currentAmount) / parseFloat(userGoals[0].targetAmount)) * 100)}%</span></div>
                  <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(parseFloat(userGoals[0].currentAmount) / parseFloat(userGoals[0].targetAmount)) * 100}%` }} /></div>
                </div>
                <p className="text-xs text-white/60">Faltam R$ {parseFloat(userGoals[0].targetAmount) - parseFloat(userGoals[0].currentAmount)} para atingir seu objetivo.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
