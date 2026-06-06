import { db } from "@/db";
import { auth } from "@/auth";
import { users, transactions, goals, categories, achievements, patients, therapySessions } from "@/db/schema";
import { eq, sum, desc, sql, count, and } from "drizzle-orm";
import { formatBRL, formatDateTime } from "@/lib/therapy";
import { getClinicalFlags } from "@/lib/clinical";
import { getManagementFlags, MGMT_FLAG_LABELS } from "@/lib/management";
import { FlagChips } from "@/components/dashboard/FlagChips";
import { Users as UsersIcon, CalendarCheck, Clock, Activity, ChevronRight } from "lucide-react";
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

  // 1. Buscar Totais
  const [balanceResult] = await db
    .select({ 
      total: sum(transactions.amount),
      income: sql<string>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end)`,
      expense: sql<string>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end)`
    })
    .from(transactions)
    .where(eq(transactions.userId, user.id));

  const totalBalance = parseFloat(balanceResult?.total || "0");
  const totalIncome = parseFloat(balanceResult?.income || "0");
  const totalExpense = parseFloat(balanceResult?.expense || "0");

  // 2. Buscar Transações Recentes com Categorias
  const recentTransactionsData = await db.query.transactions.findMany({
    where: eq(transactions.userId, user.id),
    with: {
      category: true,
    },
    orderBy: [desc(transactions.date)],
    limit: 5,
  });

  // 3. Buscar Metas
  const userGoals = await db.query.goals.findMany({
    where: eq(goals.userId, user.id),
    limit: 1,
  });

  // 4. Buscar Conquistas
  const userAchievementsData = await db.query.achievements.findMany({
    where: eq(achievements.userId, user.id),
  });

  // 5. Calcular Gamificação (XP e Nível)
  const [tCountResult] = await db
    .select({ val: count() })
    .from(transactions)
    .where(eq(transactions.userId, user.id));
  
  const totalTransactionsCount = Number(tCountResult?.val || 0);
  const xp = (totalTransactionsCount * 10) + (userAchievementsData.length * 100);
  const level = 1 + Math.floor(xp / 500);
  const nextLevelXp = level * 500;
  const currentLevelXp = xp % 500;

  // 6. Dados para o Gráfico (últimos 30 dias)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const chartData = await db
    .select({
      date: sql<string>`TO_CHAR(${transactions.date}, 'DD/MM')`,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(sql`${transactions.userId} = ${user.id} AND ${transactions.date} >= ${thirtyDaysAgo}`)
    .groupBy(sql`TO_CHAR(${transactions.date}, 'DD/MM'), ${transactions.date}`)
    .orderBy(transactions.date);

  // 6. Distribuição por Categoria (Donut Chart)
  const categoryDistribution = await db
    .select({
      name: categories.name,
      value: sum(transactions.amount),
      color: categories.color,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, user.id))
    .groupBy(categories.name, categories.color);

  // 7. Resumo do consultório (Terapia)
  const [activePatientsRes] = await db
    .select({ val: count() })
    .from(patients)
    .where(and(eq(patients.userId, user.id), eq(patients.patientStatus, "ativo")));
  const activePatients = Number(activePatientsRes?.val || 0);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [weekSessionsRes] = await db
    .select({ val: count() })
    .from(therapySessions)
    .where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${weekStart} AND ${therapySessions.date} < ${weekEnd}`);
  const weekSessions = Number(weekSessionsRes?.val || 0);

  const monthStart = new Date();
  monthStart.setHours(0, 0, 0, 0);
  monthStart.setDate(1);
  const [sessionIncomeRes] = await db
    .select({ val: sum(transactions.amount) })
    .from(transactions)
    .where(sql`${transactions.userId} = ${user.id} AND ${transactions.source} = 'session_payment' AND ${transactions.date} >= ${monthStart}`);
  const sessionIncomeMonth = parseFloat(sessionIncomeRes?.val || "0");

  // Atenção clínica (pacientes em alerta)
  const flagged = await getClinicalFlags(user.id);
  // Atenção de gestão (financeiro/contrato)
  const mgmtFlagged = await getManagementFlags(user.id);

  // Próximas sessões (agendadas, daqui pra frente)
  const now = new Date();
  const upcomingSessions = await db.query.therapySessions.findMany({
    where: sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${now} AND ${therapySessions.status} = 'agendada'`,
    with: { patient: { columns: { name: true, id: true } } },
    orderBy: [therapySessions.date],
    limit: 5,
  });

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

      {/* Resumo do consultório (cards clicáveis) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/patients" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><UsersIcon className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{activePatients}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Pacientes ativos <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
        <Link href="/dashboard/agenda" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><CalendarCheck className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{weekSessions}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Sessões na semana <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
        <Link href="/dashboard/transactions" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#047857] flex items-center justify-center font-bold shrink-0">R$</div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none break-words">{formatBRL(sessionIncomeMonth)}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Receita de sessões (mês) <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
      </section>

      {/* Próximas sessões */}
      <section className="bg-white rounded-[40px] shadow-sm border border-border p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5" /> Próximas sessões
          </h3>
          <Link href="/dashboard/agenda" className="text-sm font-semibold text-accent hover:underline">Ver agenda</Link>
        </div>
        {upcomingSessions.length === 0 ? (
          <p className="text-foreground/40 text-sm">Nenhuma sessão agendada.</p>
        ) : (
          <div className="grid gap-2">
            {upcomingSessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/patients/${s.patient?.id ?? ""}`}
                className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition"
              >
                <span className="font-mono text-sm font-semibold text-primary shrink-0">{formatDateTime(s.date as unknown as string)}</span>
                <span className="flex-1 font-medium truncate">{s.patient?.name ?? "—"}</span>
                <span className="text-xs text-foreground/40">{s.duration}min</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Atenção clínica */}
      {flagged.length > 0 && (
        <section className="bg-white rounded-[40px] shadow-sm border border-border p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <Activity className="w-5 h-5" /> Atenção clínica
            </h3>
            <Link href="/dashboard/clinico" className="text-sm font-semibold text-accent hover:underline">Ver todos ({flagged.length})</Link>
          </div>
          <div className="grid gap-2">
            {flagged.slice(0, 4).map(({ id, name, flags }) => (
              <Link key={id} href={`/dashboard/patients/${id}`} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition group">
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">{name.charAt(0).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{name}</p>
                  <div className="mt-1"><FlagChips flags={flags} /></div>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Atenção de gestão (financeiro/contrato) */}
      {mgmtFlagged.length > 0 && (
        <section className="bg-white rounded-[40px] shadow-sm border border-border p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2">
              <Wallet className="w-5 h-5" /> Atenção de gestão
            </h3>
            <span className="text-sm text-foreground/40">{mgmtFlagged.length} paciente(s)</span>
          </div>
          <div className="grid gap-2">
            {mgmtFlagged.slice(0, 6).map(({ id, name, flags }) => (
              <Link key={id} href={`/dashboard/patients/${id}`} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition group">
                <span className="w-9 h-9 rounded-xl bg-[#fffbeb] text-[#92400e] flex items-center justify-center font-display font-bold text-sm shrink-0">{name.charAt(0).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-sm">{name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {flags.map((f) => (
                      <span key={f} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e]">{MGMT_FLAG_LABELS[f]}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <BalanceCard
          title="Saldo Total"
          amount={totalBalance}
          trend="+ R$ 0,00 este mês"
          icon={<Wallet className="w-6 h-6" />}
          variant="primary"
        />
        <BalanceCard 
          title="Receitas"
          amount={totalIncome}
          trend="Baseado em dados reais"
          icon={<ArrowUpRight className="w-6 h-6" />}
          variant="secondary"
        />
        <BalanceCard 
          title="Despesas"
          amount={totalExpense}
          trend="Despesas do período"
          icon={<ArrowDownRight className="w-6 h-6" />}
          variant="white"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2 space-y-12">
          {/* Chart Section */}
          <div className="p-10 bg-white rounded-[48px] shadow-sm border border-border min-h-[450px] relative overflow-hidden group">
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <h3 className="text-2xl font-display font-bold text-primary">Evolução Patrimonial</h3>
                <p className="text-sm text-foreground/40 font-medium">Dados reais do banco</p>
              </div>
              <div className="flex-1 flex items-center justify-center py-10">
                <TransactionsChart data={chartData} />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-surface to-white pointer-events-none" />
          </div>

          <RecentTransactions transactions={recentTransactionsData} />
        </div>

        <div className="space-y-12">
          <CapiMascot 
            level={level} 
            xp={currentLevelXp} 
            nextLevelXp={500} 
            message={userAchievementsData.length > 0 ? "Bom trabalho! Sua gestão está evoluindo." : "Comece registrando pacientes e sessões."}
          />
          <CapiInsights categoryData={categoryDistribution} userId={user.id} />
          <Achievements userAchievements={userAchievementsData} />
          
          {/* Telegram Voice Highlight */}
          <div className="p-8 bg-surface-container-high rounded-[40px] border border-primary/10 relative overflow-hidden group">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#229ED9] rounded-xl flex items-center justify-center text-white shadow-lg">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M11.944 0C5.352 0 0 5.352 0 11.944c0 6.592 5.352 11.944 11.944 11.944 6.592 0 11.944-5.352 11.944-11.944C23.888 5.352 18.536 0 11.944 0zM17.84 8.163l-1.954 9.219c-.148.66-.539.822-1.092.511l-2.977-2.195-1.436 1.381c-.159.159-.292.292-.598.292l.213-3.023 5.5-4.97c.239-.213-.052-.331-.371-.118l-6.8 4.278-2.93-.915c-.637-.201-.65-.637.133-.943l11.45-4.412c.531-.193 1 .129.864.895z"/>
                  </svg>
                </div>
                <h4 className="font-display font-bold text-primary">Telegram</h4>
              </div>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Envie áudios ou textos no Telegram para registrar lançamentos na hora. A IA transcreve e categoriza para você.
              </p>
              <Link 
                href="/dashboard/settings" 
                className="inline-flex items-center gap-2 text-xs font-bold text-[#229ED9] hover:underline"
              >
                Configurar no Telegram
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#229ED9]/5 rounded-full blur-2xl group-hover:bg-[#229ED9]/10 transition-colors" />
          </div>
          
          {userGoals.length > 0 && (
            <div className="p-8 bg-primary rounded-[40px] text-white shadow-xl shadow-primary/20 space-y-6">
              <h4 className="font-bold text-lg">Meta: {userGoals[0].title}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Progresso</span>
                  <span>{Math.round((parseFloat(userGoals[0].currentAmount) / parseFloat(userGoals[0].targetAmount)) * 100)}%</span>
                </div>
                <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent rounded-full transition-all" 
                    style={{ width: `${(parseFloat(userGoals[0].currentAmount) / parseFloat(userGoals[0].targetAmount)) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-white/60">
                Faltam R$ {parseFloat(userGoals[0].targetAmount) - parseFloat(userGoals[0].currentAmount)} para atingir seu objetivo.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
