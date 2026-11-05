"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatBRL } from "@/lib/therapy";
import { removerPagamento } from "./geral-actions";
import { recebidosPorAno, anosComPagamento } from "@/lib/tabelaAnual";
import { type VigenciaTaxa } from "@/lib/taxaCartao";

type Pagamento = { id: string; amount: string; date: string; status: string; method?: string | null; kind?: string | null; estornadoEm?: string | null; virouCredito?: boolean };

/**
 * A tabela de valores recebidos por mês, DENTRO do paciente.
 *
 * O ano vem de FORA desde 17/09: o seletor é único e fica antes da tabela de Controle, valendo
 * para as duas ao mesmo tempo.
 *
 * Doc 30: com "TODOS" selecionado, uma tabela por ano (cada uma identificada pelo seu ano), em vez
 * de uma só.
 */
export function TabelaAnual({ payments, ano, vigencias = [], patientId }: { payments: Pagamento[]; ano: number | "TODOS"; vigencias?: VigenciaTaxa[]; patientId?: string }) {
  if (ano === "TODOS") {
    const anos = anosComPagamento(payments);
    if (!anos.length) return <TabelaDoAno payments={payments} ano={new Date().getFullYear()} vigencias={vigencias} patientId={patientId} />;
    return <div className="space-y-4">{anos.map((a) => <TabelaDoAno key={a} payments={payments} ano={a} vigencias={vigencias} patientId={patientId} />)}</div>;
  }
  return <TabelaDoAno payments={payments} ano={ano} vigencias={vigencias} patientId={patientId} />;
}

/**
 * A LIXEIRA DO RECEBIMENTO (Prints 16).
 *
 * É a MESMA ação da guia Geral, de propósito: "as 3 informações são vinculadas, então quando
 * apagar em um campo, excluir nos 3". `removerPagamento` apaga o pagamento, a entrada do caixa
 * ligada a ele e o crédito que ele tenha gerado — então as três telas contam a mesma história
 * sem nenhuma delas saber da outra. Uma segunda rotina de apagar seria a maneira de elas
 * divergirem.
 */
function RemoverRecebimento({ patientId, pagamentoId }: { patientId: string; pagamentoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function acionar() {
    if (!window.confirm("Remover este pagamento? A cobrança volta a ficar em aberto e a entrada sai do caixa.")) return;
    start(async () => { const r = await removerPagamento({ pagamentoId, patientId }); if (r.ok) router.refresh(); });
  }
  return (
    <button type="button" onClick={acionar} disabled={pending} title="Remover este pagamento" aria-label="Remover este pagamento"
      className="align-middle ml-1 text-[#b91c1c] hover:bg-[#fef2f2] rounded p-0.5 disabled:opacity-50 print:hidden">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function TabelaDoAno({ payments, ano, vigencias, patientId }: { payments: Pagamento[]; ano: number; vigencias: VigenciaTaxa[]; patientId?: string }) {
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
                        {/* Prints 16: a lixeira ao lado de CADA recebimento, e não na linha do mês —
                            o mês é uma soma e não diria qual pagamento sai. */}
                        {patientId && r.id && <RemoverRecebimento patientId={patientId} pagamentoId={r.id} />}
                        {/* Doc 64: o dinheiro entrou e virou crédito do paciente — continua contando
                            aqui, e é usado depois sem ser contado de novo. */}
                        {r.virouCredito && <span className="text-[11px] text-foreground/45"> · virou crédito</span>}
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
