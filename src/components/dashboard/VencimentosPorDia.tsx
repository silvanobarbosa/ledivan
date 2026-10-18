"use client";

import { useEffect, useState } from "react";
import { CalendarClock, MessageCircle, Loader2 } from "lucide-react";
import { formatBRL, SESSION_STATUS_LABELS } from "@/lib/therapy";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { mensagemDeCobranca, type CobrancaResolvida } from "@/lib/vencimentosDoDia";
import { vencimentosEm, registrarCobranca } from "@/app/dashboard/vencimentos-actions";
import { useConfirmarEnvio, ConfirmarEnvioModal } from "./confirmarEnvio";

const SIT: Record<string, { rotulo: string; cor: string }> = {
  pago: { rotulo: "Em dia", cor: "text-[#047857]" },
  em_aberto: { rotulo: "Em aberto", cor: "text-[#854d0e]" },
  em_atraso: { rotulo: "Em atraso", cor: "text-[#b91c1c]" },
};
const TIPO_VENC: Record<string, string> = { primeira: "1ª sessão do pacote", ultima: "Última sessão do pacote" };

/** Hoje no relógio local, em YYYY-MM-DD (sem passar por UTC, que viraria o dia à noite). */
function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dataBR = (iso: string | null | undefined) => {
  const m = iso ? String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
const horaBR = (iso: string | null | undefined) => {
  const m = iso ? String(iso).match(/T(\d{2}:\d{2})/) : null;
  return m ? m[1] : "";
};

/**
 * Vencimentos por dia (doc 44): abaixo de Pagamentos no Dashboard. Seletor de data (default hoje, NÃO
 * persistido — recarregar volta para hoje), tabela de sessões avulsas e tabela de pacotes que vencem
 * na data. O botão Cobrar abre o WhatsApp com a mensagem preenchida e registra o acionamento.
 */
export function VencimentosPorDia() {
  const [dia, setDia] = useState(hojeLocal());
  const [avulsas, setAvulsas] = useState<CobrancaResolvida[]>([]);
  const [pacotes, setPacotes] = useState<CobrancaResolvida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviadas, setEnviadas] = useState<Record<string, number>>({});
  // Doc 47: abrir o WhatsApp não conta; só conta após confirmar o envio no retorno.
  const confirmar = useConfirmarEnvio<CobrancaResolvida>();

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- buscar os vencimentos ao montar e a cada troca de data É o efeito desejado
    setCarregando(true);
    vencimentosEm(dia).then((r) => {
      if (!vivo) return;
      setAvulsas(r.ok ? r.avulsas ?? [] : []);
      setPacotes(r.ok ? r.pacotes ?? [] : []);
      setEnviadas({});
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [dia]);

  function cobrar(c: CobrancaResolvida, texto: string) {
    // Doc 47: abre o WhatsApp e deixa a confirmação pendente — NÃO registra agora.
    const num = numeroDoWhatsapp(c.telefone);
    confirmar.abrir(num ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : null, c);
  }
  function registrarSeConfirmado(c: CobrancaResolvida) {
    void registrarCobranca(c.cadastroId, c.chave);
    setEnviadas((e) => ({ ...e, [c.chave]: (e[c.chave] ?? c.enviosTotal) + 1 }));
  }
  const totalEnvios = (c: CobrancaResolvida) => enviadas[c.chave] ?? c.enviosTotal;
  // Doc 45: quitado mostra "Pago em [data]" (sem Cobrar nem contagem). Valor = saldo em aberto;
  // quando quitado, o valor cheio. Coluna Vencimento: data no dia específico; texto na 1ª/última.
  const pago = (c: CobrancaResolvida) => c.situacao === "pago";
  const valorExibido = (c: CobrancaResolvida) => (pago(c) ? c.valor : c.falta);
  const vencimentoCol = (c: CobrancaResolvida) => (c.tipoVencimento === "primeira" || c.tipoVencimento === "ultima" ? TIPO_VENC[c.tipoVencimento] : dataBR(c.vencimento));
  const temTelefone = (c: CobrancaResolvida) => !!numeroDoWhatsapp(c.telefone);

  // Doc 50: títulos centralizados.
  const th = "px-2 py-2 text-center font-bold whitespace-nowrap";
  const td = "px-2 py-2 whitespace-nowrap";
  const btnCobrar = "inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition disabled:opacity-40";

  return (
    <section className="glass-card rounded-[24px] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Vencimentos por dia
        </h3>
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value || hojeLocal())}
          className="px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" aria-label="Data dos vencimentos" />
      </div>

      {carregando ? (
        <p className="text-sm text-foreground/40 py-4 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
      ) : (
        <>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground/70">Sessões avulsas</h4>
            {avulsas.length === 0 ? (
              <p className="text-sm text-foreground/40">Nenhuma sessão avulsa vence nesta data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-foreground/50 border-b border-border">
                    {/* Doc 50: avulsa mostra data+hora da sessão; coluna "Horário de atraso" removida; título "Cobrar" sem texto. */}
                    <tr><th className={th}>Nome</th><th className={th}>Data da sessão</th><th className={th}>Valor</th><th className={th}>Status</th><th className={th} /><th className={th}>Cobranças enviadas</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {avulsas.map((c) => (
                      <tr key={c.chave}>
                        <td className={`${td} font-semibold`}>{c.nome}</td>
                        <td className={td}>{dataBR(c.dataSessao)} {horaBR(c.dataSessao)}</td>
                        <td className={`${td} tabular-nums`}>{formatBRL(valorExibido(c))}</td>
                        <td className={`${td} font-semibold ${SIT[c.situacao]?.cor ?? ""}`}>{SIT[c.situacao]?.rotulo ?? c.situacao}</td>
                        <td className={td}>{pago(c) ? <span className="text-[11px] text-[#047857] whitespace-nowrap">Pago em {dataBR(c.pagoEm)}</span> : <button type="button" onClick={() => cobrar(c, mensagemDeCobranca(c))} disabled={!temTelefone(c)} title={temTelefone(c) ? "Cobrar pelo WhatsApp" : "Cadastro sem telefone"} className={btnCobrar}><MessageCircle className="w-3.5 h-3.5" /> Cobrar</button>}</td>
                        <td className={`${td} tabular-nums text-center`}>{pago(c) ? "—" : totalEnvios(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground/70">Pacotes</h4>
            {pacotes.length === 0 ? (
              <p className="text-sm text-foreground/40">Nenhum pacote vence nesta data.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-foreground/50 border-b border-border">
                    {/* Doc 50: título "Cobrar" sem texto (só o conteúdo da coluna). */}
                    <tr><th className={th}>Nome</th><th className={th}>Vencimento</th><th className={th}>1ª sessão</th><th className={th}>Última sessão</th><th className={th}>Última realizada</th><th className={th}>Status</th><th className={th}>Valor a pagar</th><th className={th} /><th className={th}>Cobranças enviadas</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pacotes.map((c) => (
                      <tr key={c.chave}>
                        <td className={`${td} font-semibold`}>{c.nome}</td>
                        <td className={td}>{vencimentoCol(c)}</td>
                        <td className={td}>{dataBR(c.primeiraSessao)}</td>
                        <td className={td}>{dataBR(c.ultimaSessao)}</td>
                        <td className={td}>{c.ultimaRealizada ? `${dataBR(c.ultimaRealizada.data)} – ${c.ultimaRealizada.seq} – ${SESSION_STATUS_LABELS[c.ultimaRealizada.status] ?? c.ultimaRealizada.status}` : "—"}</td>
                        <td className={`${td} font-semibold ${SIT[c.situacao]?.cor ?? ""}`}>{SIT[c.situacao]?.rotulo ?? c.situacao}</td>
                        <td className={`${td} tabular-nums`}>{formatBRL(valorExibido(c))}</td>
                        <td className={td}>{pago(c) ? <span className="text-[11px] text-[#047857] whitespace-nowrap">Pago em {dataBR(c.pagoEm)}</span> : <button type="button" onClick={() => cobrar(c, mensagemDeCobranca(c))} disabled={!temTelefone(c)} title={temTelefone(c) ? "Cobrar pelo WhatsApp" : "Cadastro sem telefone"} className={btnCobrar}><MessageCircle className="w-3.5 h-3.5" /> Cobrar</button>}</td>
                        <td className={`${td} tabular-nums text-center`}>{pago(c) ? "—" : totalEnvios(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      <ConfirmarEnvioModal aberto={confirmar.pendente != null} onSim={() => confirmar.resolver(true, registrarSeConfirmado)} onNao={() => confirmar.resolver(false, registrarSeConfirmado)} />
    </section>
  );
}
