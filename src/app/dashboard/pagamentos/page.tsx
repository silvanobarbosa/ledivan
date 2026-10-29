import { auth } from "@/auth";
import { Banknote } from "lucide-react";
import { eq, sql } from "drizzle-orm";
import { type PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { sessionPayments, therapySessions } from "@/db/schema";
import { PagamentosClient } from "./PagamentosClient";

export const dynamic = "force-dynamic";

/**
 * A Carteira: o ano escolhido e "Por mês — todos os cadastros", que vem do motor de cobrança por
 * Server Action (`pagamentosPorMesDoAno`). A página em si não lê pagamento nenhum — o quadro "Por
 * cadastro — mês a mês", que lia, saiu no doc 64.
 */
export default async function PagamentosPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const year = Number((await searchParams).year) || new Date().getFullYear();

  /**
   * TODOS os anos que o sistema já conhece (doc 65) — o seletor mostrava três (ano-1, ano, ano+1),
   * e quem quisesse 2023 tinha de voltar um ano de cada vez, recarregando a Carteira a cada passo.
   *
   * A lista sai de onde o dinheiro aparece: as sessões (que geram as cobranças) e os pagamentos
   * lançados. Agrupado no banco — trazer uma linha por sessão só para extrair o ano seria ler a
   * agenda inteira a cada abertura da tela. O ano corrente e o escolhido entram sempre, para a
   * terapeuta que abre em janeiro, antes da primeira sessão, poder escolher o ano em que está.
   */
  const userId = session.user.id;
  const anoSql = (col: PgColumn) => sql<number>`extract(year from ${col})::int`;
  const [anosSessao, anosPagamento] = await Promise.all([
    db.select({ ano: anoSql(therapySessions.date) }).from(therapySessions).where(eq(therapySessions.userId, userId)).groupBy(anoSql(therapySessions.date)),
    db.select({ ano: anoSql(sessionPayments.date) }).from(sessionPayments).where(eq(sessionPayments.userId, userId)).groupBy(anoSql(sessionPayments.date)),
  ]);
  const anos = [...new Set([
    ...anosSessao.map((r) => Number(r.ano)),
    ...anosPagamento.map((r) => Number(r.ano)),
    new Date().getFullYear(),
    year,
  ].filter((a) => Number.isInteger(a) && a > 2000 && a < 2100))].sort((a, b) => b - a);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Banknote className="w-7 h-7" /> Carteira
        </h1>
        <p className="text-foreground/50 mt-1 text-justify">Recebimentos por <strong>mês</strong>, com acompanhamento dos <strong>valores recebidos</strong> e <strong>cobrança dos pagamentos em aberto</strong>.</p>
      </div>
      <PagamentosClient year={year} anos={anos} />
    </div>
  );
}
