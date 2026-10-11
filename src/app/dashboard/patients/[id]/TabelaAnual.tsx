"use client";

import { formatBRL } from "@/lib/therapy";
import { recebidosPorAno, anosComPagamento } from "@/lib/tabelaAnual";

type Pagamento = { id: string; amount: string; date: string; status: string };

/**
 * A tabela de valores recebidos por mês, DENTRO do paciente.
 *
 * O ano vem de FORA desde 17/09: o seletor é único e fica antes da tabela de Controle, valendo
 * para as duas ao mesmo tempo.
 *
 * Doc 30: com "TODOS" selecionado, uma tabela por ano (cada uma identificada pelo seu ano), em vez
 * de uma só.
 */
export function TabelaAnual({ payments, ano }: { payments: Pagamento[]; ano: number | "TODOS" }) {
  if (ano === "TODOS") {
    const anos = anosComPagamento(payments);
    if (!anos.length) return <TabelaDoAno payments={payments} ano={new Date().getFullYear()} />;
    return <div className="space-y-4">{anos.map((a) => <TabelaDoAno key={a} payments={payments} ano={a} />)}</div>;
  }
  return <TabelaDoAno payments={payments} ano={ano} />;
}

function TabelaDoAno({ payments, ano }: { payments: Pagamento[]; ano: number }) {
  const { meses, total } = recebidosPorAno(payments, ano);

  return (
    <div className="glass-card rounded-[24px] p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Valores recebidos em {ano}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-foreground/40">
            <th className="px-3 py-2 font-bold">Mês</th>
            <th className="px-3 py-2 font-bold text-right">Valor recebido</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes} className="border-t border-border">
              <td className="px-3 py-1.5">{m.mes}</td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${m.valor > 0 ? "" : "text-foreground/30"}`}>{m.valor > 0 ? formatBRL(m.valor) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-bold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-primary">{formatBRL(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
