"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Loader2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { mensagemDeCobranca, type CobrancaResolvida } from "@/lib/vencimentosDoDia";
import { type MesPagamentos, type ResumoAno, type LinhaPagamento } from "@/lib/pagamentosPorMes";
import { pagamentosPorMesDoAno, registrarCobranca } from "@/app/dashboard/vencimentos-actions";
import { useConfirmarEnvio, ConfirmarEnvioModal } from "@/components/dashboard/confirmarEnvio";

const dataBR = (iso: string | null | undefined) => { const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null; return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };

/**
 * "Por mês — todos os cadastros" (doc 46): montado pelo motor da guia Geral. Cards de resumo do ano
 * (Atrasados/Em aberto/Pagos) + tabela por mês com ID, Vencimento, Atrasado, Em aberto, Pago, Cobrar e
 * Cobranças enviadas. O ID leva à ficha do cadastro. Cobrar reaproveita o comportamento do Vencimentos.
 */
export function PorMesCadastros({ year }: { year: number }) {
  const [meses, setMeses] = useState<MesPagamentos[]>([]);
  const [resumo, setResumo] = useState<ResumoAno | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<Record<string, number>>({});
  const confirmar = useConfirmarEnvio<CobrancaResolvida>();

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- buscar os dados ao montar / trocar o ano É o efeito
    setCarregando(true);
    pagamentosPorMesDoAno(year).then((r) => {
      if (!vivo) return;
      setMeses(r.ok ? r.meses ?? [] : []);
      setResumo(r.ok ? r.resumo ?? null : null);
      setAberto(null); // doc 50: todos os meses começam reduzidos (inclusive o primeiro)
      setCarregando(false);
    }).catch(() => {
      // Falhou: mostra o erro em vez de girar para sempre. Sem este `catch`, qualquer recusa da
      // Server Action (rede, sessão vencida, conta somente leitura) deixava o spinner eterno — a
      // tela dizia "carregando" para sempre e nada chegava a quem olha.
      if (!vivo) return;
      setMeses([]);
      setResumo(null);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [year]);

  const cobrar = (c: CobrancaResolvida) => {
    const num = numeroDoWhatsapp(c.telefone);
    confirmar.abrir(num ? `https://wa.me/${num}?text=${encodeURIComponent(mensagemDeCobranca(c))}` : null, c);
  };
  const registrar = (c: CobrancaResolvida) => {
    void registrarCobranca(c.cadastroId, c.chave);
    setEnviadas((e) => ({ ...e, [c.chave]: (e[c.chave] ?? c.enviosTotal) + 1 }));
  };
  const envios = (c: LinhaPagamento) => enviadas[c.chave] ?? c.enviosTotal;
  // Doc 50: coluna "Nome" com o ID do cadastro (agenda); sem agenda, cai no nome.
  const idLabel = (c: LinhaPagamento) => (c.agendaId?.trim() ? c.agendaId : c.nome);

  // Doc 50: títulos centralizados.
  const th = "px-2 py-2 text-center font-bold whitespace-nowrap";
  const td = "px-2 py-2 whitespace-nowrap";

  return (
    <div className="glass-card rounded-[24px] p-5 space-y-4">
      <h3 className="font-display text-lg font-bold text-primary">Por mês — todos os cadastros</h3>

      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#fee2e2] border border-[#fecaca] p-4"><div className="flex items-center gap-2 text-[#b91c1c] font-bold"><AlertTriangle className="w-4 h-4" /> Atrasados</div><p className="text-xl font-display font-bold text-[#b91c1c] mt-1">{formatBRL(resumo.atrasados.total)}</p><p className="text-xs text-foreground/50">{resumo.atrasados.qtd} cobrança(s)</p></div>
          <div className="rounded-2xl bg-[#fef9c3] border border-[#fde68a] p-4"><div className="flex items-center gap-2 text-[#854d0e] font-bold"><Clock className="w-4 h-4" /> Em aberto</div><p className="text-xl font-display font-bold text-[#854d0e] mt-1">{formatBRL(resumo.aberto.total)}</p><p className="text-xs text-foreground/50">{resumo.aberto.qtd} cobrança(s)</p></div>
          <div className="rounded-2xl bg-[#dcfce7] border border-[#bbf7d0] p-4"><div className="flex items-center gap-2 text-[#166534] font-bold"><CheckCircle2 className="w-4 h-4" /> Pagos</div><p className="text-xl font-display font-bold text-[#166534] mt-1">{formatBRL(resumo.pagos.total)}</p><p className="text-xs text-foreground/50">{resumo.pagos.qtd} cobrança(s)</p></div>
        </div>
      )}

      {carregando ? (
        <p className="text-sm text-foreground/40 py-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
      ) : meses.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhuma cobrança neste ano.</p>
      ) : (
        <div className="space-y-2">
          {meses.map((m) => (
            <div key={m.mes} className="rounded-2xl border border-border overflow-hidden">
              <button type="button" onClick={() => setAberto((a) => (a === m.mes ? null : m.mes))} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface/60 hover:bg-surface transition text-left">
                <span className="font-bold text-primary">{m.rotulo}</span>
                <span className="text-xs text-foreground/60 tabular-nums">esperado {formatBRL(m.esperado)} · pago {formatBRL(m.pago)} · em aberto {formatBRL(m.aberto)}</span>
              </button>
              {aberto === m.mes && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-foreground/50 border-b border-border">
                      {/* Doc 50: "Nome" = id do cadastro; cores atraso vermelho / em aberto preto / pago azul;
                          "Pago" quebrado por forma, com o líquido em verde no débito/crédito. */}
                      <tr><th className={th}>Nome</th><th className={th}>Vencimento</th><th className={th}>Atrasado</th><th className={th}>Em aberto</th><th className={th}>Pago</th><th className={th} /><th className={th}>Cobranças enviadas</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {m.cobrancas.map((c) => {
                        const pago = c.situacao === "pago";
                        const formas = c.recebido?.formas ?? [];
                        return (
                          <tr key={c.chave}>
                            <td className={`${td} font-semibold`}><Link href={`/dashboard/patients/${c.cadastroId}`} className="text-primary hover:underline">{idLabel(c)}</Link></td>
                            <td className={td}>{dataBR(c.vencimento)}</td>
                            <td className={`${td} tabular-nums ${c.atrasado > 0 ? "text-[#b91c1c] font-semibold" : "text-foreground/30"}`}>{c.atrasado > 0 ? formatBRL(c.atrasado) : "—"}</td>
                            <td className={`${td} tabular-nums ${c.emAberto > 0 ? "text-foreground" : "text-foreground/30"}`}>{c.emAberto > 0 ? formatBRL(c.emAberto) : "—"}</td>
                            <td className={`${td} tabular-nums`}>
                              {formas.length === 0 ? <span className="text-foreground/30">—</span> : (
                                <div className="space-y-0.5">
                                  {formas.map((f) => (
                                    <div key={f.metodo}>
                                      <span className="text-[#2563eb]">{formatBRL(f.bruto)} {f.curto}</span>
                                      {f.temTaxa && <span className="block text-[11px] text-[#047857]">Líquido {formatBRL(f.liquido)}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className={td}>{pago ? <span className="text-[11px] text-[#047857] whitespace-nowrap">Pago em {dataBR(c.pagoEm)}</span> : <button type="button" onClick={() => cobrar(c)} disabled={!numeroDoWhatsapp(c.telefone)} title={numeroDoWhatsapp(c.telefone) ? "Cobrar pelo WhatsApp" : "Cadastro sem telefone"} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition disabled:opacity-40"><MessageCircle className="w-3.5 h-3.5" /> Cobrar</button>}</td>
                            <td className={`${td} tabular-nums text-center`}>{pago ? "—" : envios(c)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmarEnvioModal aberto={confirmar.pendente != null} web={confirmar.web} onSim={() => confirmar.resolver(true, registrar)} onNao={() => confirmar.resolver(false, registrar)} />
    </div>
  );
}
