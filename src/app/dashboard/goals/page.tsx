import { db } from "@/db";
import { goals } from "@/db/schema";
import { auth } from "@/auth";
import { eq, desc } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { Target, Calendar, Trophy, Trash2 } from "lucide-react";
import { AddGoalForm } from "./AddGoalForm";
import { addAmountToGoal, deleteGoal } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userGoals = await db.query.goals.findMany({
    where: eq(goals.userId, session.user.id),
    orderBy: [desc(goals.createdAt)],
  });

  const formatCurrency = (val: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(val));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <section className="space-y-2">
          <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">Suas Metas</h2>
          <p className="text-lg text-foreground/40 font-medium">Transforme seus sonhos em realidade, passo a passo.</p>
        </section>
        <AddGoalForm />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {userGoals.map((goal) => {
          const progress = Math.min(100, Math.round((parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100));
          
          return (
            <div key={goal.id} className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-8 group hover:border-primary/20 transition-all relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Target className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{goal.title}</h3>
                    <p className="text-sm text-foreground/40 font-medium">Meta para o futuro</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {progress === 100 && (
                    <div className="p-3 bg-accent/20 text-primary rounded-full">
                      <Trophy className="w-6 h-6" />
                    </div>
                  )}
                  <form action={deleteGoal.bind(null, goal.id)}>
                    <SubmitButton pendingLabel="" className="p-3 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </SubmitButton>
                  </form>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Acumulado</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(goal.currentAmount)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Objetivo</p>
                    <p className="text-xl font-bold text-foreground/60">{formatCurrency(goal.targetAmount)}</p>
                  </div>
                </div>

                <div className="h-4 w-full bg-surface rounded-full overflow-hidden border border-border">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      progress === 100 ? "bg-green-500" : "bg-primary"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/40">
                    <Calendar className="w-4 h-4" />
                    <span>{goal.deadline ? new Date(goal.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                  </div>
                  <span className="text-xs font-bold text-primary px-3 py-1 bg-primary/5 rounded-lg">
                    {progress}% concluído
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <form action={async (formData) => {
                  "use server";
                  const amount = formData.get("amount") as string;
                  if (amount) await addAmountToGoal(goal.id, amount);
                }} className="flex gap-4">
                  <input 
                    name="amount"
                    type="number" 
                    step="0.01"
                    placeholder="R$ 0,00"
                    className="flex-1 p-3 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-bold text-sm"
                  />
                  <SubmitButton pendingLabel="Salvando…" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-primary rounded-2xl hover:opacity-90 transition">
                    Poupado!
                  </SubmitButton>
                </form>
              </div>
            </div>
          );
        })}

        {userGoals.length === 0 && (
          <div className="col-span-full p-20 bg-surface/50 rounded-[48px] border-2 border-dashed border-border flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-sm">
              🏔️
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Nenhuma meta ativa</h3>
              <p className="text-foreground/40 font-medium max-w-sm">Comece a poupar hoje para conquistar seus sonhos amanhã.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
