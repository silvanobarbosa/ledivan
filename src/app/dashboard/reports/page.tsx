/* eslint-disable react-hooks/immutability --
   Componente de SERVIDOR (React Server Component): não tem "use client", roda uma vez por
   requisição e nunca re-renderiza no navegador. A regra acima vem do React Compiler e
   descreve o render de CLIENTE — lá, criar componente durante o render causa remonte, ler o
   relógio quebra a hidratação e reatribuir variável atrapalha a memoização. Nada disso existe
   aqui: no servidor, ler a hora e acumular num acumulador local durante o render é idiomático.
   Se este arquivo um dia virar cliente (ganhar "use client"), REMOVA este bloco e trate os
   achados de verdade — eles passam a valer. */
import { db } from "@/db";
import { auth } from "@/auth";
import { transactions } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { formatBRL } from "@/lib/therapy";
import { carregarNetter } from "@/lib/receitaLiquida";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import Link from "next/link";

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

  // Doc 49: as receitas entram pelo valor LÍQUIDO (desconta a taxa de cartão vigente na data do
  // pagamento). Por isso iteramos as linhas (precisamos da forma + data de cada uma) em vez de somar
  // no banco. Despesa não tem taxa — entra pelo valor cheio.
  const net = await carregarNetter(userId);
  const txs = await db
    .select({ amount: transactions.amount, type: transactions.type, method: transactions.method, date: transactions.date, source: transactions.source })
    .from(transactions)
    .where(whereClause);

  const porMes = new Map<string, { income: number; expense: number; sessionIncome: number }>();
  const ymDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  for (const t of txs) {
    const ym = ymDe(t.date);
    const m = porMes.get(ym) ?? { income: 0, expense: 0, sessionIncome: 0 };
    const bruto = parseFloat(t.amount) || 0;
    if (t.type === "income") {
      const liq = net(bruto, t.method, t.date.toISOString());
      m.income += liq;
      if (t.source === "session_payment") m.sessionIncome += liq;
    } else {
      m.expense += bruto;
    }
    porMes.set(ym, m);
  }

  const data = [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, m]) => ({ ym, income: m.income, expense: m.expense, net: m.income - m.expense, sessionIncome: m.sessionIncome }));

  const totalIncome = data.reduce((a, d) => a + d.income, 0);
  const totalExpense = data.reduce((a, d) => a + d.expense, 0);
  const totalNet = totalIncome - totalExpense;
  const maxBar = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));

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
      {/* Doc 46: saíram os gráficos (receitas × despesas por mês, saldo acumulado, despesas por
          categoria, receitas por origem). Abaixo de cada mês ficam as linhas Sessões e Receitas. */}

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
              {/* Doc 46: compor o total de receita — Sessões (pacientes+supervisionados) e Receitas lançadas. */}
              <div className="text-[11px] text-foreground/40 space-y-0.5">
                <p><strong>Sessões:</strong> {formatBRL(d.sessionIncome)} <span className="text-foreground/30">do total recebido entre pacientes e supervisionados</span></p>
                <p><strong>Receitas:</strong> {formatBRL(d.income - d.sessionIncome)} <span className="text-foreground/30">do total recebido de receitas lançadas</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
