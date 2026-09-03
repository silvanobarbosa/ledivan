import { db } from "@/db";
import { auth } from "@/auth";
import { users, transactions, categories } from "@/db/schema";
import { eq, sum, desc, sql, count } from "drizzle-orm";
import { formatBRL } from "@/lib/therapy";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { CapiInsights } from "@/components/dashboard/CapiInsights";
import { TransactionsChart } from "@/components/dashboard/TransactionsChart";
import { Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FinanceiroDashboard() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return null;

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const monthStart = new Date(); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(1);

  const [balanceRows, recentTransactionsData, chartData, categoryDistribution, sessionIncomeRows] = await Promise.all([
    db.select({
      total: sum(transactions.amount),
      income: sql<string>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end)`,
      expense: sql<string>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end)`,
    }).from(transactions).where(eq(transactions.userId, user.id)),
    db.query.transactions.findMany({ where: eq(transactions.userId, user.id), with: { category: true }, orderBy: [desc(transactions.date)], limit: 5 }),
    db.select({ date: sql<string>`TO_CHAR(${transactions.date}, 'DD/MM')`, total: sum(transactions.amount) })
      .from(transactions).where(sql`${transactions.userId} = ${user.id} AND ${transactions.date} >= ${thirtyDaysAgo}`)
      .groupBy(sql`TO_CHAR(${transactions.date}, 'DD/MM'), ${transactions.date}`).orderBy(transactions.date),
    db.select({ name: categories.name, value: sum(transactions.amount), color: categories.color })
      .from(transactions).innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.userId, user.id)).groupBy(categories.name, categories.color),
    db.select({ val: sum(transactions.amount) }).from(transactions).where(sql`${transactions.userId} = ${user.id} AND ${transactions.source} = 'session_payment' AND ${transactions.date} >= ${monthStart}`),
  ]);

  const totalIncome = parseFloat(balanceRows[0]?.income || "0");
  const totalExpense = parseFloat(balanceRows[0]?.expense || "0");
  const totalBalance = totalIncome - totalExpense; // saldo = receitas − despesas (antes somava sem sinal)
  const sessionIncomeMonth = parseFloat(sessionIncomeRows[0]?.val || "0");

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <section className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f766e] bg-[#ccfbef] px-3 py-1.5 rounded-full mb-2">💼 Financeiro</div>
        <h2 className="text-3xl lg:text-4xl font-display font-bold text-primary tracking-tight">Visão financeira</h2>
        <p className="text-foreground/40 font-medium">Caixa do consultório — receitas e despesas.</p>
      </section>

      <Link href="/dashboard/reports" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.01] transition w-full sm:w-auto sm:inline-flex">
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
          <CapiInsights categoryData={categoryDistribution} userId={user.id} />
        </div>
      </div>
    </div>
  );
}
