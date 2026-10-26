"use client";

import { formatBRL } from "@/lib/therapy";
import { recebidosPorAno, anosComPagamento, type EstornoAnual } from "@/lib/tabelaAnual";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

type Pagamento = { id: string; amount: string; date: string; status: string; method?: string | null };

/**
 * A tabela de valores recebidos por mês, DENTRO do paciente.
 *
 * O ano vem de FORA desde 17/09: o seletor é único e fica antes da tabela de Controle, valendo
 * para as duas ao mesmo tempo.
 *
 * Doc 30: com "TODOS" selecionado, uma tabela por ano (cada uma identificada pelo seu ano), em vez
 * de uma só.
 */
export function TabelaAnual({ payments, ano, vigencias = [], estornos = [] }: { payments: Pagamento[]; ano: number | "TODOS"; vigencias?: VigenciaTaxa[]; estornos?: EstornoAnual[] }) {
  if (ano === "TODOS") {
    const anos = anosComPagamento(payments);
    if (!anos.length) return <TabelaDoAno payments={payments} ano={new Date().getFullYear()} vigencias={vigencias} estornos={estornos} />;
    return <div className="space-y-4">{anos.map((a) => <TabelaDoAno key={a} payments={payments} ano={a} vigencias={vigencias} estornos={estornos} />)}</div>;
  }
  return <TabelaDoAno payments={payments} ano={ano} vigencias={vigencias} estornos={estornos} />;
}

function TabelaDoAno({ payments, ano, vigencias, estornos }: { payments: Pagamento[]; ano: number; vigencias: VigenciaTaxa[]; estornos: EstornoAnual[] }) {
  const { meses, total } = recebidosPorAno(payments, ano, vigencias, estornos);

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
              <td className="px-3 py-1.5 align-top">{m.mes}</td>
              {/* Doc 53: o valor vem com a FORMA ao lado, e nos cartões o líquido logo abaixo.
                  O total da linha segue sendo o líquido — é o que entrou na conta. Mostrar o
                  bruto por forma serve para conferir contra o comprovante da maquininha. */}
              <td className={`px-3 py-1.5 text-right tabular-nums ${m.valor > 0 || m.estornado > 0 ? "" : "text-foreground/30"}`}>
                {/* Doc 60: o dinheiro que VOLTOU aparece aqui também, em vermelho e negativo.
                    Só a entrada à mostra fazia o mês afirmar um recebimento que foi desfeito. */}
                {m.estornado > 0 && (
                  <span className="block text-[#b91c1c]">− {formatBRL(m.estornado)} estornado</span>
                )}
                {m.valor > 0 ? (
                  <>
                    {m.formas.map((f) => (
                      <span key={f.metodo} className="block">
                        <span className="text-[#2563eb]">{formatBRL(f.bruto)} {f.curto}</span>
                        {f.temTaxa && <span className="block text-[11px] text-[#047857]">Líquido {formatBRL(f.liquido)}</span>}
                      </span>
                    ))}
                    {(m.formas.length > 1 || m.estornado > 0) && (
                      <span className="block text-[11px] text-foreground/50 border-t border-border mt-1 pt-1">{formatBRL(Math.round((m.valor - m.estornado) * 100) / 100)}</span>
                    )}
                  </>
                ) : m.estornado > 0 ? null : "—"}
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
