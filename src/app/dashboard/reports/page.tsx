import { db } from "@/db";
import { auth } from "@/auth";
import { transactions, categories } from "@/db/schema";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { formatBRL } from "@/lib/therapy";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import Link from "next/link";
import { ReportsCharts } from "./ReportsCharts";

const SOURCE_LABELS: Record<string, string> = { manual: "Manual", telegram: "Telegram", scan: "Scan", session_payment: "Sessões" };

export const dynamic = "force-dynamic";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]}/${y}`;
}

const PERIODS: Record<string, { label: string; months: number | null }> = {
  "6m": { label: "6 meses", months: 6 },
  "12m": { label: "12 meses", months: 12 },
  all: { label: "Tudo", months: null },
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const { period, from, to } = await searchParams;
  const custom = period === "custom" && (from || to);
  const activePeriod = custom ? "custom" : period && PERIODS[period] ? period : "12m";
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let cutoff: Date | null = null;
  let end: Date | null = null;
  if (custom) {
    if (from) { cutoff = new Date(from); cutoff.setHours(0, 0, 0, 0); }
    if (to) { end = new Date(to); end.setHours(23, 59, 59, 999); }
  } else {
    const months = PERIODS[activePeriod].months;
    if (months) { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setMonth(cutoff.getMonth() - months); }
  }

  const dateConds = [eq(transactions.userId, userId)];
  if (cutoff) dateConds.push(gte(transactions.date, cutoff));
  if (end) dateConds.push(lte(transactions.date, end));
  const whereClause = and(...dateConds);

  const rows = await db
    .select({
      ym: sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`,
      income: sql<string>`sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end)`,
      expense: sql<string>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end)`,
      sessionIncome: sql<string>`sum(case when ${transactions.source} = 'session_payment' then ${transactions.amount} else 0 end)`,
    })
    .from(transactions)
    .where(whereClause)
    .groupBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM') DESC`);

  // Despesas por categoria + receitas por origem (no período)
  const catRows = await db
    .select({ name: categories.name, color: categories.color, value: sql<string>`sum(${transactions.amount})` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(whereClause, eq(transactions.type, "expense")))
    .groupBy(categories.name, categories.color);

  const srcRows = await db
    .select({ source: transactions.source, value: sql<string>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(whereClause, eq(transactions.type, "income")))
    .groupBy(transactions.source);

  const chartCategories = catRows.map((r) => ({ name: r.name || "Sem categoria", color: r.color, value: parseFloat(r.value || "0") }));
  const chartSources = srcRows.map((r) => ({ name: SOURCE_LABELS[r.source] || r.source, value: parseFloat(r.value || "0") }));

  const data = rows.map((r) => {
    const income = parseFloat(r.income || "0");
    const expense = parseFloat(r.expense || "0");
    return {
      ym: r.ym,
      income,
      expense,
      net: income - expense,
      sessionIncome: parseFloat(r.sessionIncome || "0"),
    };
  });

  const totalIncome = data.reduce((a, d) => a + d.income, 0);
  const totalExpense = data.reduce((a, d) => a + d.expense, 0);
  const totalNet = totalIncome - totalExpense;
  const maxBar = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));

  // Série mensal ascendente + saldo acumulado (para os gráficos)
  let acc = 0;
  const chartMonthly = [...data].reverse().map((d) => {
    acc += d.net;
    return { label: monthLabel(d.ym), income: d.income, expense: d.expense, net: d.net, cumulative: acc };
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Relatórios</h1>
          <p className="text-foreground/50 mt-1">Resumo financeiro mês a mês</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PERIODS).map(([key, p]) => (
            <Link
              key={key}
              href={`/dashboard/reports?period=${key}`}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                activePeriod === key ? "bg-primary text-white" : "bg-white/60 text-foreground/60 hover:bg-white"
              }`}
            >
              {p.label}
            </Link>
          ))}
          <form method="get" className="flex items-center gap-1.5 rounded-full bg-white/60 px-2 py-1">
            <input type="hidden" name="period" value="custom" />
            <input type="date" name="from" defaultValue={from || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
            <span className="text-xs text-foreground/40">→</span>
            <input type="date" name="to" defaultValue={to || ""} className="text-xs bg-transparent outline-none px-1 py-1" />
            <button className={`px-3 py-1 rounded-full text-xs font-bold transition ${activePeriod === "custom" ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>Aplicar</button>
          </form>
        </div>
      </div>

      {/* Totais */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#ecfdf5] text-[#047857] flex items-center justify-center"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-xl font-display font-bold text-primary leading-none">{formatBRL(totalIncome)}</p><p className="text-sm text-foreground/50 mt-1">Receitas (total)</p></div>
        </div>
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#fee2e2] text-[#b91c1c] flex items-center justify-center"><TrendingDown className="w-6 h-6" /></div>
          <div><p className="text-xl font-display font-bold text-primary leading-none">{formatBRL(totalExpense)}</p><p className="text-sm text-foreground/50 mt-1">Despesas (total)</p></div>
        </div>
        <div className="glass-card rounded-[28px] p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Scale className="w-6 h-6" /></div>
          <div><p className={`text-xl font-display font-bold leading-none ${totalNet >= 0 ? "text-[#047857]" : "text-[#b91c1c]"}`}>{formatBRL(totalNet)}</p><p className="text-sm text-foreground/50 mt-1">Saldo (total)</p></div>
        </div>
      </div>

      {/* Gráficos do fluxo financeiro */}
      <ReportsCharts monthly={chartMonthly} categories={chartCategories} sources={chartSources} />

      {/* Tabela mensal */}
      {data.length === 0 ? (
        <p className="text-center py-16 text-foreground/40">Sem dados financeiros ainda.</p>
      ) : (
        <div className="glass-card rounded-[32px] p-6 space-y-4">
          {data.map((d) => (
            <div key={d.ym} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-primary capitalize">{monthLabel(d.ym)}</span>
                <span className={`text-sm font-bold ${d.net >= 0 ? "text-[#047857]" : "text-[#b91c1c]"}`}>
                  {d.net >= 0 ? "+" : ""}{formatBRL(d.net)}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 rounded-full bg-[#047857]" style={{ width: `${(d.income / maxBar) * 100}%`, minWidth: d.income > 0 ? "8px" : "0" }} />
                  <span className="text-xs text-foreground/50 shrink-0">{formatBRL(d.income)} receita</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 rounded-full bg-[#b91c1c]" style={{ width: `${(d.expense / maxBar) * 100}%`, minWidth: d.expense > 0 ? "8px" : "0" }} />
                  <span className="text-xs text-foreground/50 shrink-0">{formatBRL(d.expense)} despesa</span>
                </div>
              </div>
              {d.sessionIncome > 0 && (
                <p className="text-[11px] text-foreground/40">Sessões: {formatBRL(d.sessionIncome)} do total de receitas</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
