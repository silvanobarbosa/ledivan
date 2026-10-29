"use client";

import { useRouter } from "next/navigation";
import { PorMesCadastros } from "./PorMesCadastros";

/**
 * A Carteira (doc 63): o ano escolhido e, abaixo, "Por mês — todos os cadastros".
 *
 * O quadro "Por cadastro — mês a mês" SAIU (doc 64, pedido da dona): ele repetia, por cadastro, o
 * que a guia Geral do paciente já mostra em "Valores recebidos" — e só lá o número passa pelo motor
 * de cobrança, com crédito e estorno tratados. Duas tabelas com o mesmo nome e contas diferentes é
 * o começo de toda desconfiança.
 */
export function PagamentosClient({ year, anos }: { year: number; anos: number[] }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/50">Ano:</span>
          <select value={year} onChange={(e) => router.push(`/dashboard/pagamentos?year=${e.target.value}`)} className="px-3 py-1.5 rounded-xl bg-surface border border-border text-sm outline-none">
            {/* Doc 65: a lista inteira de anos já cadastrados, vinda do servidor. */}
            {anos.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <PorMesCadastros year={year} />
    </div>
  );
}
