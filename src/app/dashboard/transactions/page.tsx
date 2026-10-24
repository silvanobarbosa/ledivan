import { db } from "@/db";
import { auth } from "@/auth";
import { transactions, categories, financialAccounts, sessionPayments, despesas, receitasPessoais } from "@/db/schema";
import { eq, desc, ilike, and, gte, lte, or, isNull, isNotNull } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { AddTransaction } from "./AddTransaction";
import { DespesasSection, type DespesaLinha } from "./DespesasSection";
import { ReceitasSection, type ReceitaLinha } from "./ReceitasSection";
import { MovimentacoesSection } from "./MovimentacoesSection";
import { ExportCSV } from "./ExportCSV";
import { deleteTransaction } from "./actions";
import { Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import Link from "next/link";
import { PAYMENT_FORM_LABELS } from "@/lib/finance";
import { carregarNetter } from "@/lib/receitaLiquida";

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

  const [allTransactions, allCategories, userAccounts, despesasRows, receitasRows, despesasDoLivro] = await Promise.all([
    db.query.transactions.findMany({
      where: and(...conds),
      with: { category: true },
      orderBy: [desc(transactions.date)],
    }),
    db.query.categories.findMany({ where: or(isNull(categories.userId), eq(categories.userId, userId)) }),
    db.query.financialAccounts.findMany({ where: eq(financialAccounts.userId, userId) }),
    db.select({ id: despesas.id, nome: despesas.nome, valor: despesas.valor, vencimento: despesas.vencimento, pagamentoData: despesas.pagamentoData })
      .from(despesas).where(eq(despesas.userId, userId)).orderBy(desc(despesas.vencimento)),
    db.select({ id: receitasPessoais.id, nome: receitasPessoais.nome, valor: receitasPessoais.valor, recebimento: receitasPessoais.recebimento, recebido: receitasPessoais.recebido })
      .from(receitasPessoais).where(eq(receitasPessoais.userId, userId)).orderBy(desc(receitasPessoais.recebimento)),
    /**
     * As despesas do LIVRO, SEM o filtro de período da tela.
     *
     * `allTransactions` é a lista da tabela de lançamentos, e ela obedece ao filtro e à busca. O
     * quadro de Despesas não — as cadastradas aparecem todas. Montá-lo a partir da lista filtrada
     * faria metade do quadro encolher ao filtrar e a outra metade não, que é confusão nova no lugar
     * da que se está consertando.
     */
    db.select({ id: transactions.id, amount: transactions.amount, date: transactions.date, description: transactions.description, categoria: categories.name })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense")))
      .orderBy(desc(transactions.date)),
  ]);

  const hojeISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  /**
   * O quadro de Despesas mostra as duas origens: as cadastradas aqui e as lançadas no LIVRO.
   *
   * A tela se contradizia — "Nenhuma despesa cadastrada" logo acima de anos de despesas lançadas.
   * As duas estavam certas; olhavam lugares diferentes. Agora o quadro é o lugar de olhar.
   *
   * A despesa do livro entra para LER: o lançamento original guarda categoria, forma de pagamento e
   * conta, que este quadro não tem, e editá-la daqui apagaria esse histórico sem avisar. Ela se
   * edita na tabela de lançamentos, logo abaixo — e a linha diz isso.
   *
   * Uma despesa lançada no livro já aconteceu: vencimento e pagamento são a data do lançamento.
   */
  const doLivro: DespesaLinha[] = despesasDoLivro.map((t) => ({
    id: t.id,
    nome: t.description?.trim() || t.categoria || "Despesa",
    valor: t.amount,
    vencimento: t.date.toISOString(),
    pagamentoData: t.date.toISOString(),
    doLivro: true,
  }));
  const despesasLista: DespesaLinha[] = [
    ...despesasRows.map((d) => ({ id: d.id, nome: d.nome, valor: d.valor, vencimento: d.vencimento.toISOString(), pagamentoData: d.pagamentoData ? d.pagamentoData.toISOString() : null })),
    ...doLivro,
  ].sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  const receitasLista: ReceitaLinha[] = receitasRows.map((r) => ({ id: r.id, nome: r.nome, valor: r.valor, recebimento: r.recebimento.toISOString(), recebido: r.recebido }));

  /**
   * Quais entradas vieram de um pagamento de paciente.
   *
   * Elas não se apagam por aqui: o pagamento e a entrada do caixa são o mesmo fato, e apagar só um
   * lado deixava a guia Geral dizendo "Pago" com o dinheiro fora do caixa. A tela troca a lixeira
   * pelo caminho certo (dono, 18/09).
   */
  const dePagamento = new Map(
    (await db
      .select({ transacao: sessionPayments.linkedTransactionId, patientId: sessionPayments.patientId })
      .from(sessionPayments)
      .where(and(eq(sessionPayments.userId, userId), isNotNull(sessionPayments.linkedTransactionId))))
      .map((r) => [r.transacao as string, r.patientId]),
  );

  const net = await carregarNetter(userId);

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

      {/* Despesas + Receitas pessoais + Movimentações/extrato (doc 50) */}
      <DespesasSection despesas={despesasLista} hoje={hojeISO} />
      <ReceitasSection receitas={receitasLista} />
      <MovimentacoesSection />

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
                  {(() => {
                    // Líquido de taxa: só em RECEITA no cartão, quando a taxa foi configurada e desconta algo.
                    if (t.type !== "income") return null;
                    const bruto = parseFloat(t.amount);
                    const liq = net(bruto, t.method, t.date.toISOString());
                    if (!(liq < bruto)) return null;
                    return <p className="text-[11px] font-semibold text-foreground/40 mt-0.5">líquido {formatCurrency(liq.toFixed(2))}</p>;
                  })()}
                </td>
                <td className="p-6 text-right">
                  {dePagamento.has(t.id) ? (
                    <Link
                      href={`/dashboard/patients/${dePagamento.get(t.id)}`}
                      title="Veio de um pagamento de paciente. Para desfazer, use “Remover pagamento” na guia Geral dele — assim os dois saem juntos."
                      className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                    >
                      do paciente →
                    </Link>
                  ) : (
                    <form action={removeTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmSubmit message="Excluir este lançamento? Esta ação não pode ser desfeita." title="Excluir" className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-foreground/40 hover:text-red-600 transition p-1">
                        <Trash2 className="w-4 h-4" />
                      </ConfirmSubmit>
                    </form>
                  )}
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
