import { db } from "@/db";
import { auth } from "@/auth";
import { transactions, categories, financialAccounts } from "@/db/schema";
import { eq, desc, ilike, and, gte, lte, or, isNull } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { AddTransaction } from "./AddTransaction";
import { ExportCSV } from "./ExportCSV";
import { deleteTransaction } from "./actions";
import { Trash2 } from "lucide-react";
import { PAYMENT_FORM_LABELS } from "@/lib/finance";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  telegram: "Telegram",
  scan: "Scan",
  session_payment: "Sessão",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { q, from, to } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const conds = [eq(transactions.userId, userId)];
  if (q) conds.push(ilike(transactions.description, `%${q}%`));
  if (from) { const d = new Date(from); d.setHours(0, 0, 0, 0); conds.push(gte(transactions.date, d)); }
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); conds.push(lte(transactions.date, d)); }

  const [allTransactions, allCategories, userAccounts] = await Promise.all([
    db.query.transactions.findMany({
      where: and(...conds),
      with: { category: true },
      orderBy: [desc(transactions.date)],
    }),
    db.query.categories.findMany({ where: or(isNull(categories.userId), eq(categories.userId, userId)) }),
    db.query.financialAccounts.findMany({ where: eq(financialAccounts.userId, userId) }),
  ]);

  const removeTransaction = async (formData: FormData) => {
    "use server";
    await deleteTransaction(formData.get("id") as string);
  };

  const formatCurrency = (val: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(val));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">
            {q ? `Resultados para "${q}"` : "Transações"}
          </h2>
          <p className="text-lg text-foreground/40 font-medium">Receitas e despesas do consultório.</p>
        </div>
        <div className="flex gap-3">
          <ExportCSV
            rows={allTransactions.map((t) => ({
              date: formatDate(t.date),
              description: t.description || "",
              category: t.category?.name || "",
              type: t.type === "income" ? "Receita" : "Despesa",
              source: SOURCE_LABELS[t.source] || t.source,
              amount: t.amount,
            }))}
          />
          <AddTransaction categories={allCategories} accounts={userAccounts.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>

      {/* Filtro por período (data início/fim) */}
      <form method="get" className="flex flex-wrap items-center gap-2 glass-card rounded-2xl px-4 py-3">
        {q && <input type="hidden" name="q" value={q} />}
        <span className="text-sm font-semibold text-foreground/50">Período:</span>
        <input type="date" name="from" defaultValue={from || ""} className="text-sm bg-surface border border-border rounded-xl px-3 py-2 outline-none" />
        <span className="text-foreground/40">→</span>
        <input type="date" name="to" defaultValue={to || ""} className="text-sm bg-surface border border-border rounded-xl px-3 py-2 outline-none" />
        <button className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-xl">Filtrar</button>
        {(from || to) && <a href="/dashboard/transactions" className="text-sm font-semibold text-foreground/50 hover:text-primary px-2">limpar</a>}
      </form>

      <div className="bg-white rounded-[40px] shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left border-collapse">
          <thead>
            <tr className="bg-surface/50 border-b border-border">
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Data</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Descrição</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Categoria</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Origem</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Forma</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest text-right">Valor</th>
              <th className="p-6 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {allTransactions.map((t) => (
              <tr key={t.id} className="border-b border-border hover:bg-surface/30 transition-colors group">
                <td className="p-6 text-sm font-medium text-foreground/60">{formatDate(t.date)}</td>
                <td className="p-6">
                  <p className="text-sm font-bold text-foreground">{t.description || "Sem descrição"}</p>
                </td>
                <td className="p-6">
                  <span className="px-3 py-1 bg-surface rounded-full text-xs font-bold text-primary border border-primary/10">
                    {t.category?.name || "Outros"}
                  </span>
                </td>
                <td className="p-6">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    t.source === "telegram" ? "bg-blue-50 text-blue-600" :
                    t.source === "scan" ? "bg-accent/20 text-primary" :
                    t.source === "session_payment" ? "bg-[#f3e8ff] text-primary" : "bg-surface text-foreground/40"
                  )}>
                    {SOURCE_LABELS[t.source] || t.source}
                  </span>
                </td>
                <td className="p-6">
                  {t.method ? (
                    <span className="text-xs font-semibold text-foreground/60">{PAYMENT_FORM_LABELS[t.method] || t.method}</span>
                  ) : <span className="text-xs text-foreground/30">—</span>}
                </td>
                <td className={cn(
                  "p-6 text-sm font-bold text-right",
                  t.type === "income" ? "text-green-600" : "text-red-600"
                )}>
                  {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                </td>
                <td className="p-6 text-right">
                  <form action={removeTransaction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-foreground/40 hover:text-red-600 transition p-1" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {allTransactions.length === 0 && (
          <div className="p-20 text-center space-y-4">
            <p className="text-4xl">📭</p>
            <p className="text-foreground/40 font-medium">Nenhuma transação encontrada {q ? `para "${q}"` : ""}.</p>
          </div>
        )}
      </div>
    </div>
  );
}
