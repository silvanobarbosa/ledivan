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
import { FiltroPeriodo } from "./FiltroPeriodo";
import { dentroDoIntervalo, intervaloDoPeriodo, periodoDaUrl, rotuloDoIntervalo } from "@/lib/periodoFiltro";

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
  searchParams: Promise<{ q?: string; periodo?: string; de?: string; ate?: string }>;
}) {
  const { q, periodo: periodoUrl, de, ate } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  /*
   * Doc 64: o recorte por período, no alto da página, valendo para a tela inteira.
   *
   * "Mês atual" é o que vale ao entrar — a dona abre aqui para ver o mês, não a vida toda. O
   * filtro antigo (Período → Filtrar), que existia só para a tabela de lançamentos lá embaixo,
   * saiu junto com ela.
   */
  const periodo = periodoDaUrl(periodoUrl);
  const intervalo = intervaloDoPeriodo(periodo, new Date(), de, ate);
  const rotuloPeriodo = rotuloDoIntervalo(periodo, intervalo);

  const conds = [eq(transactions.userId, userId)];
  if (q) conds.push(ilike(transactions.description, `%${q}%`));
  if (intervalo.de) { const d = new Date(`${intervalo.de}T00:00:00`); conds.push(gte(transactions.date, d)); }
  if (intervalo.ate) { const d = new Date(`${intervalo.ate}T23:59:59`); conds.push(lte(transactions.date, d)); }

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
  ]
    // Doc 64: o quadro obedece ao recorte do alto da página. A data que manda é a do PAGAMENTO
    // quando houve, e a do vencimento quando ainda não — a mesma que a linha mostra em destaque.
    .filter((d) => dentroDoIntervalo(d.pagamentoData ?? d.vencimento, intervalo))
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));
  const receitasLista: ReceitaLinha[] = receitasRows
    .map((r) => ({ id: r.id, nome: r.nome, valor: r.valor, recebimento: r.recebimento.toISOString(), recebido: r.recebido }))
    .filter((r) => dentroDoIntervalo(r.recebimento, intervalo));

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

      {/* Doc 64: o recorte vale para a tela toda e nasce no MÊS ATUAL. */}
      <FiltroPeriodo periodo={periodo} de={de} ate={ate} />

      {/* Despesas + Receitas pessoais + Movimentações/extrato (doc 50) */}
      <DespesasSection despesas={despesasLista} hoje={hojeISO} rotuloPeriodo={rotuloPeriodo} />
      <ReceitasSection receitas={receitasLista} rotuloPeriodo={rotuloPeriodo} />
      <MovimentacoesSection intervalo={intervalo} rotulo={rotuloPeriodo} />

      {/*
        A TABELA DE LANÇAMENTOS SAIU (doc 64, pedido da dona), e o filtro "Período → Filtrar" que
        existia só para ela saiu junto.

        O que ela mostrava — despesas, receitas pessoais e pagamentos de pacientes em ordem
        cronológica — é exatamente o que Movimentações mostra, com o recorte do alto da página.
        Duas listas do mesmo dinheiro, uma obedecendo a um filtro e a outra a outro, é confusão
        nova no lugar da que se está consertando.

        A exclusão de um lançamento do livro, que só existia ali, passou para a lixeira do quadro de
        Despesas: sem isso, uma despesa lançada no livro ficaria sem nenhum caminho para sair.
      */}
    </div>
  );
}
