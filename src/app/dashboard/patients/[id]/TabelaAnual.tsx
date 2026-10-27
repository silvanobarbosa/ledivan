"use client";

import { formatBRL } from "@/lib/therapy";
import { recebidosPorAno, anosComPagamento } from "@/lib/tabelaAnual";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

type Pagamento = { id: string; amount: string; date: string; status: string; method?: string | null; kind?: string | null; estornadoEm?: string | null };

/**
 * A tabela de valores recebidos por mês, DENTRO do paciente.
 *
 * O ano vem de FORA desde 17/09: o seletor é único e fica antes da tabela de Controle, valendo
 * para as duas ao mesmo tempo.
 *
 * Doc 30: com "TODOS" selecionado, uma tabela por ano (cada uma identificada pelo seu ano), em vez
 * de uma só.
 */
export function TabelaAnual({ payments, ano, vigencias = [] }: { payments: Pagamento[]; ano: number | "TODOS"; vigencias?: VigenciaTaxa[] }) {
  if (ano === "TODOS") {
    const anos = anosComPagamento(payments);
    if (!anos.length) return <TabelaDoAno payments={payments} ano={new Date().getFullYear()} vigencias={vigencias} />;
    return <div className="space-y-4">{anos.map((a) => <TabelaDoAno key={a} payments={payments} ano={a} vigencias={vigencias} />)}</div>;
  }
  return <TabelaDoAno payments={payments} ano={ano} vigencias={vigencias} />;
}

function TabelaDoAno({ payments, ano, vigencias }: { payments: Pagamento[]; ano: number; vigencias: VigenciaTaxa[] }) {
  const { meses, total } = recebidosPorAno(payments, ano, vigencias);

  return (
    <div className="glass-card rounded-[24px] p-4 sm:p-5" data-testid="valores-recebidos">
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
              <td className="px-3 py-1.5 align-top">{m.mes}</td>
              {/* Doc 62: UM recebimento por linha — valor, forma e dia —, e só o dinheiro que entrou
                  de verdade. O agregado por forma escondia quantos pagamentos havia e em que dia
                  cada um caiu, que é justamente o que se confere contra o extrato do banco.
                  O líquido do cartão (doc 53) continua logo abaixo do seu recebimento. */}
              <td className={`px-3 py-1.5 text-right tabular-nums ${m.recebimentos.length ? "" : "text-foreground/30"}`}>
                {m.recebimentos.length ? (
                  <>
                    {m.recebimentos.map((r, i) => (
                      <span key={i} className="block">
                        <span className="text-[#2563eb]">{formatBRL(r.valor)} {r.curto} {r.data}</span>
                        {r.temTaxa && <span className="block text-[11px] text-[#047857]">Líquido {formatBRL(r.liquido)}</span>}
                      </span>
                    ))}
                    {m.recebimentos.length > 1 && (
                      <span className="block text-[11px] text-foreground/50 border-t border-border mt-1 pt-1">{formatBRL(m.valor)}</span>
                    )}
                  </>
                ) : "—"}
              </td>
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
