import { auth } from "@/auth";
import { Banknote } from "lucide-react";
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Banknote className="w-7 h-7" /> Carteira
        </h1>
        <p className="text-foreground/50 mt-1 text-justify">Recebimentos por <strong>mês</strong>, com acompanhamento dos <strong>valores recebidos</strong> e <strong>cobrança dos pagamentos em aberto</strong>.</p>
      </div>
      <PagamentosClient year={year} />
    </div>
  );
}
