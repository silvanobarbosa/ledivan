import { db } from "@/db";
import { auth } from "@/auth";
import { users, transactions, categories } from "@/db/schema";
import { eq, desc, ilike, and } from "drizzle-orm";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user) return null;

  const allTransactions = await db.query.transactions.findMany({
    where: q 
      ? and(eq(transactions.userId, user.id), ilike(transactions.description, `%${q}%`))
      : eq(transactions.userId, user.id),
    with: {
      category: true,
    },
    orderBy: [desc(transactions.date)],
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">
            {q ? `Resultados para "${q}"` : "Transações"}
          </h2>
          <p className="text-lg text-foreground/40 font-medium">Histórico completo da sua vida financeira.</p>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface/50 border-b border-border">
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Data</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Descrição</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Categoria</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest">Origem</th>
              <th className="p-6 text-xs font-bold text-foreground/40 uppercase tracking-widest text-right">Valor</th>
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
                    t.source === "scan" ? "bg-accent/20 text-primary" : "bg-surface text-foreground/40"
                  )}>
                    {t.source}
                  </span>
                </td>
                <td className={cn(
                  "p-6 text-sm font-bold text-right",
                  t.type === "income" ? "text-green-600" : "text-red-600"
                )}>
                  {t.type === "income" ? "+" : "-"} {formatCurrency(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
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
