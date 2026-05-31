import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  description: string | null;
  amount: string;
  date: Date;
  type: "income" | "expense";
  category?: {
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
}

export function RecentTransactions({ transactions, id }: { transactions: any[], id?: string }) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div id={id} className="p-8 bg-white rounded-[40px] shadow-sm border border-border">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-display font-bold text-primary">Atividade Recente</h3>
        <button className="text-sm font-bold text-primary hover:underline">Ver Todas</button>
      </div>

      <div className="space-y-6">
        {transactions.length === 0 ? (
          <p className="text-center text-foreground/40 py-10 italic">Nenhuma transação recente.</p>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center text-xl group-hover:scale-110 transition-all border border-transparent group-hover:border-primary/20"
                  style={{ color: t.category?.color || 'inherit' }}
                >
                  {/* Usa o mapeamento de ícones ou fallback */}
                  {t.category?.name === "Alimentação" && "🛒"}
                  {t.category?.name === "Transporte" && "⛽"}
                  {t.category?.name === "Salário" && "💼"}
                  {t.category?.name === "Lazer" && "🍿"}
                  {t.category?.name === "Saúde" && "🏥"}
                  {t.category?.name === "Investimentos" && "📈"}
                  {!["Alimentação", "Transporte", "Salário", "Lazer", "Saúde", "Investimentos"].includes(t.category?.name || "") && "💰"}
                </div>
                <div>
                  <p className="font-bold text-foreground">{t.description || "Sem descrição"}</p>
                  <p className="text-xs text-foreground/40">
                    {formatDate(t.date)} • {t.category?.name || "Sem categoria"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-bold",
                  t.type === "income" ? "text-green-600" : "text-red-600"
                )}>
                  {t.type === "income" ? "+" : "-"} {formatCurrency(parseFloat(t.amount))}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
