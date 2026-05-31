import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { auth } from "@/auth";
import { eq, sum, sql } from "drizzle-orm";
import { Bell, AlertTriangle, CheckCircle, Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Buscar gastos por categoria para gerar alertas
  const categorySpending = await db
    .select({
      name: categories.name,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, session.user.id))
    .groupBy(categories.name);

  // Lógica simples de alerta (ex: se gastou mais de 1000 em uma categoria)
  const alerts = categorySpending.map(c => {
    const total = parseFloat(c.total || "0");
    if (total > 1000) {
      return {
        type: "warning",
        title: `Gasto elevado em ${c.name}`,
        message: `Você já gastou R$ ${total.toFixed(2)} em ${c.name} este mês. Considere revisar seu orçamento.`,
        icon: AlertTriangle,
        color: "text-red-500 bg-red-50"
      };
    }
    return null;
  }).filter(Boolean);

  const systemNotifications = [
    { type: "info", title: "CapiBot Conectado", message: "Seu bot do Telegram está ativo e pronto para receber transações.", icon: Info, color: "text-blue-500 bg-blue-50" },
    { type: "success", title: "Backup Concluído", message: "Seus dados foram sincronizados com sucesso no Neon Cloud.", icon: CheckCircle, color: "text-green-500 bg-green-50" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">Centro de Alertas</h2>
        <p className="text-lg text-foreground/40 font-medium">Fique por dentro de tudo o que acontece com seu dinheiro.</p>
      </section>

      <div className="space-y-6">
        {alerts.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground/30 uppercase tracking-widest px-4">Alertas Críticos</h3>
            {alerts.map((alert: any, i) => (
              <div key={i} className={`p-8 rounded-[40px] border border-border flex gap-6 items-start transition-all hover:scale-[1.01] ${alert.color}`}>
                <div className="p-4 bg-white rounded-3xl shadow-sm">
                  <alert.icon className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-foreground">{alert.title}</h4>
                  <p className="text-foreground/60 font-medium">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-foreground/30 uppercase tracking-widest px-4">Notificações do Sistema</h3>
          {systemNotifications.map((note, i) => (
            <div key={i} className="p-8 bg-white rounded-[40px] border border-border flex gap-6 items-start transition-all hover:scale-[1.01]">
              <div className={`p-4 rounded-3xl ${note.color}`}>
                <note.icon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-foreground">{note.title}</h4>
                <p className="text-foreground/60 font-medium">{note.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {alerts.length === 0 && (
        <div className="p-20 bg-green-50/30 rounded-[48px] border border-green-100 flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-sm border border-green-100">
            🌱
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-green-800">Tudo sob controle!</h3>
            <p className="text-green-600/70 font-medium max-w-sm">Nenhum alerta crítico encontrado para seu perfil este mês.</p>
          </div>
        </div>
      )}
    </div>
  );
}
