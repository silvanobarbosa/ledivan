"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Loader2, AlertTriangle, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { formatBRL } from "@/lib/therapy";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { mensagemDeCobranca, type CobrancaResolvida } from "@/lib/vencimentosDoDia";
import { type MesPagamentos, type ResumoAno, type LinhaPagamento } from "@/lib/pagamentosPorMes";
import { pagamentosPorMesDoAno, registrarCobranca } from "@/app/dashboard/vencimentos-actions";
import { useConfirmarEnvio, ConfirmarEnvioModal } from "@/components/dashboard/confirmarEnvio";

const dataBR = (iso: string | null | undefined) => { const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null; return m ? `${m[3]}/${m[2]}/${m[1]}` : "—"; };

/**
 * O ANO desta cobrança (doc 64) — é com ele que a guia Geral abre no "Gerenciar".
 *
 * Vale o ano do PAGAMENTO quando houve pagamento, e o do vencimento quando ainda não houve: é a
 * data que a dona tem na mão quando clica. Sem nenhuma das duas, o ano corrente.
 */
function anoDaCobranca(c: LinhaPagamento): number {
  const m = String(c.pagoEm ?? c.vencimento ?? "").match(/^(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

/** Os totais do mês (doc 64): atrasado, em aberto e pago, somando as cobranças daquele mês. */
function totaisDoMes(m: MesPagamentos): { atrasado: number; emAberto: number; bruto: number; liquido: number } {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    atrasado: r2(m.cobrancas.reduce((a, c) => a + c.atrasado, 0)),
    emAberto: r2(m.cobrancas.reduce((a, c) => a + c.emAberto, 0)),
    bruto: r2(m.cobrancas.reduce((a, c) => a + (c.recebido?.totalBruto ?? 0), 0)),
    liquido: r2(m.cobrancas.reduce((a, c) => a + (c.recebido?.totalLiquido ?? 0), 0)),
  };
}

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
                      <tr><th className={th}>Nome</th><th className={th}>Vencimento</th><th className={th}>Atrasado</th><th className={th}>Em aberto</th><th className={th}>Pago</th><th className={th} /><th className={th}>Cobranças enviadas</th><th className={th} /></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {m.cobrancas.map((c) => {
                        const pago = c.situacao === "pago";
                        const formas = c.recebido?.formas ?? [];
                        return (
                          <tr key={c.chave}>
                            <td className={`${td} font-semibold`}><Link href={`/dashboard/patients/${c.cadastroId}?ano=${anoDaCobranca(c)}&cobranca=${encodeURIComponent(c.chave)}`} className="text-primary hover:underline">{idLabel(c)}</Link></td>
                            {/* Doc 64: vencimento, atrasado e em aberto centralizados — como já eram os títulos. */}
                            <td className={`${td} text-center`}>{dataBR(c.vencimento)}</td>
                            <td className={`${td} text-center tabular-nums ${c.atrasado > 0 ? "text-[#b91c1c] font-semibold" : "text-foreground/30"}`}>{c.atrasado > 0 ? formatBRL(c.atrasado) : "—"}</td>
                            <td className={`${td} text-center tabular-nums ${c.emAberto > 0 ? "text-foreground" : "text-foreground/30"}`}>{c.emAberto > 0 ? formatBRL(c.emAberto) : "—"}</td>
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
                            {/* Doc 64: "Pago em" em preto — o verde é a cor do líquido, e aqui confundia. */}
                            <td className={td}>{pago ? <span className="text-[11px] text-foreground whitespace-nowrap">Pago em {dataBR(c.pagoEm)}</span> : <button type="button" onClick={() => cobrar(c)} disabled={!numeroDoWhatsapp(c.telefone)} title={numeroDoWhatsapp(c.telefone) ? "Cobrar pelo WhatsApp" : "Cadastro sem telefone"} className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition disabled:opacity-40"><MessageCircle className="w-3.5 h-3.5" /> Cobrar</button>}</td>
                            <td className={`${td} tabular-nums text-center`}>{pago ? "—" : envios(c)}</td>
                            {/* Doc 64: Gerenciar leva à guia Geral do cadastro JÁ no ano desta cobrança — a
                                dona cobrava de 2025 e caía no ano corrente, tendo de trocar na mão. */}
                            <td className={`${td} text-center`}>
                              <Link href={`/dashboard/patients/${c.cadastroId}?ano=${anoDaCobranca(c)}&cobranca=${encodeURIComponent(c.chave)}`}
                                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-surface border border-border text-primary hover:bg-white transition whitespace-nowrap">
                                <ExternalLink className="w-3.5 h-3.5" /> Gerenciar
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Doc 64: o total do mês, com as mesmas cores das colunas. */}
                      {(() => {
                        const t = totaisDoMes(m);
                        return (
                          <tr className="bg-surface/40 font-bold">
                            <td className={`${td} text-foreground/60`}>Total do mês</td>
                            <td className={`${td} text-center text-foreground/30`}>—</td>
                            <td className={`${td} text-center tabular-nums ${t.atrasado > 0 ? "text-[#b91c1c]" : "text-foreground/30"}`}>{t.atrasado > 0 ? formatBRL(t.atrasado) : "—"}</td>
                            <td className={`${td} text-center tabular-nums ${t.emAberto > 0 ? "text-foreground" : "text-foreground/30"}`}>{t.emAberto > 0 ? formatBRL(t.emAberto) : "—"}</td>
                            <td className={`${td} tabular-nums`}>
                              {t.bruto > 0 ? (
                                <>
                                  <span className="text-[#2563eb]">{formatBRL(t.bruto)}</span>
                                  {t.liquido < t.bruto && <span className="block text-[11px] text-[#047857] font-semibold">Líquido {formatBRL(t.liquido)}</span>}
                                </>
                              ) : <span className="text-foreground/30">—</span>}
                            </td>
                            <td className={td} /><td className={td} /><td className={td} />
                          </tr>
                        );
                      })()}
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
