"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { type Movimentacao } from "@/lib/extratoBancario";
import { montarMovimentacoes } from "./movimentacoes-actions";

const dataBR = (iso: string | null | undefined) => { const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null; return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };

/**
 * Movimentações — extrato bancário (doc 50). Lista única cronológica de despesas, receitas pessoais e
 * pagamentos de pacientes/supervisionados. Valor: entrada efetivada verde, saída efetivada vermelho,
 * previsto/pendente em branco. Pagamento no cartão mostra bruto e, abaixo, o líquido.
 */
export function MovimentacoesSection() {
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- montar o extrato ao abrir É o efeito
    setCarregando(true);
    montarMovimentacoes().then((r) => {
      if (!vivo) return;
      setMovs(r.ok ? r.movs ?? [] : []);
      setCarregando(false);
    }).catch(() => {
      // Falhou: mostra o erro em vez de girar para sempre. Sem este `catch`, qualquer recusa da
      // Server Action (rede, sessão vencida, conta somente leitura) deixava o spinner eterno — a
      // tela dizia "carregando" para sempre e nada chegava a quem olha.
      if (!vivo) return;
      setErro(true);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-primary">Movimentações</h3>
        <p className="text-sm text-foreground/50">Extrato da clínica: despesas, receitas pessoais e pagamentos de pacientes, em ordem cronológica. Verde = recebido · vermelho = pago · em branco = previsto/pendente.</p>
      </div>

      {carregando ? (
        <p className="text-sm text-foreground/40 py-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Montando o extrato…</p>
      ) : erro ? (
        <p className="text-sm text-red-600 py-4">Não foi possível montar o extrato. Recarregue a página.</p>
      ) : movs.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhuma movimentação.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-center text-[11px] uppercase tracking-wide text-foreground/40 border-b border-border">
                <th className="py-2">Data</th><th className="py-2 text-left">Descrição</th><th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m, i) => (
                <tr key={i} className="border-b border-border/40 align-top">
                  <td className="py-2 text-center tabular-nums whitespace-nowrap">{dataBR(m.data)}</td>
                  <td className="py-2">{m.descricao}</td>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {!m.efetivado ? (
                      <span className="text-foreground/25">—</span>
                    ) : (
                      <div>
                        <span className={m.tipo === "entrada" ? "text-[#047857] font-semibold" : "text-[#b91c1c] font-semibold"}>
                          {m.tipo === "entrada" ? "+" : "−"} {formatBRL(m.bruto)}
                        </span>
                        {m.temLiquido && <span className="block text-[11px] text-foreground/50">líquido {formatBRL(m.liquido)}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
