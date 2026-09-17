"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Video } from "lucide-react";
import { Check, MessageCircle } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABELS, sessionColorClasses } from "@/lib/therapy";
import type { CobrancaNaTela, LinhaNaTela } from "@/lib/geralDoPaciente";
import { montarMensagemCobranca } from "@/lib/mensagemCobranca";
import { lancarPagamento, limparEnviosDaCobranca, registrarCobrancaEnviada } from "./geral-actions";
import { doAno } from "@/lib/filtroDeAno";

/** Dados para o botão "Cobrar" compor a mensagem da terapeuta. */
export type CobrarInfo = { telefone: string | null; nome: string; modelo: string | null };

/** Abre o WhatsApp com a mensagem de cobrança pronta (ou copia, se não houver telefone). */
function BotaoCobrar({ patientId, c, cobrar }: { patientId: string; c: CobrancaNaTela; cobrar: CobrarInfo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const msg = montarMensagemCobranca(cobrar.modelo, {
    nome: cobrar.nome,
    valor: formatBRL(c.falta),
    vencimento: c.vencimento ? partes(c.vencimento).data : null,
  });
  const tel = (cobrar.telefone || "").replace(/\D/g, "");
  /**
   * Abre o WhatsApp E registra o aviso.
   *
   * O botao "Marcar enviada" saiu (documento de 17/09): o registro deixa de depender de alguem
   * lembrar de apertar um segundo botao. A janela abre primeiro — se o registro demorar, quem
   * cobra nao fica esperando.
   */
  function acionar() {
    if (tel) window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    else navigator.clipboard?.writeText(msg);
    start(async () => {
      await registrarCobrancaEnviada({ patientId, cobrancaChave: c.chave });
      router.refresh();
    });
  }
  return (
    <button type="button" onClick={acionar} disabled={pending} title={tel ? "Cobrar pelo WhatsApp (registra o aviso)" : "Copiar mensagem de cobranca (registra o aviso)"}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] border border-[#a7f3d0] bg-[#ecfdf5] rounded-full px-2 py-0.5 hover:bg-[#d1fae5] disabled:opacity-60 whitespace-nowrap">
      <MessageCircle className="w-3 h-3" aria-hidden /> {pending ? "..." : "Cobrar"}
    </button>
  );
}

/**
 * A guia Geral: sessões e pagamentos numa tabela só, na ordem em que acontecem.
 *
 * As linhas chegam prontas do servidor (`geralDoPaciente`) — a tela só desenha. Quem decide onde
 * vai cada pagamento, quanto vale e se está em aberto é o motor único de cobranças.
 */

// Texto de hora de parede ("2026-09-01T09:00:00") → partes, sem passar por fuso.
const partes = (t: string) => {
  const [d, h = ""] = t.split("T");
  const [a, m, dia] = d.split("-");
  return { data: `${dia}/${m}/${a.slice(2)}`, hora: h.slice(0, 5) };
};

const SITUACAO: Record<CobrancaNaTela["situacao"], { rotulo: string; cls: string }> = {
  pago: { rotulo: "Pago", cls: "bg-[#dcfce7] text-[#166534]" },
  em_aberto: { rotulo: "Em aberto", cls: "bg-surface text-foreground/60" },
  em_atraso: { rotulo: "Em atraso", cls: "bg-[#fee2e2] text-[#991b1b]" },
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Só estes cinco status aparecem na coluna Status da Geral (dono, 16/09/2026). Sem status = célula
// vazia, sem cor. As cores são as mesmas da agenda.
const STATUS_GERAL: Record<string, string> = {
  realizada: "Presente", nao_realizada: "Faltou", cancelada: "Desmarcou",
  realocada: "Desmarcou", prof_desmarcou: "Prof. desm.", atestado: "Atestado",
};
function CelulaStatus({ status }: { status?: string | null }) {
  const rotulo = status ? STATUS_GERAL[status] : undefined;
  if (!rotulo || !status) return <td className="px-3 py-2" />;
  return (
    <td className="px-3 py-2">
      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${sessionColorClasses(status)}`}>{rotulo}</span>
    </td>
  );
}

/**
 * O HISTORICO de avisos daquela cobranca.
 *
 * Nao ha mais botao de marcar: cada clique em "Cobrar" registra um aviso. Aqui aparece o ultimo, e
 * quantas vezes ao todo — porque "avisei uma vez" e "avisei tres vezes" pedem atitudes diferentes.
 * As datas completas ficam no `title`, para nao encher a linha.
 */
function EnvioControle({ patientId, chave, envio }: { patientId: string; chave: string; envio: CobrancaNaTela["envio"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!envio) return null;

  const limpar = () =>
    start(async () => {
      const r = await limparEnviosDaCobranca({ patientId, cobrancaChave: chave });
      if (r.ok) router.refresh();
    });

  const historico = envio.datas.map((d) => partes(d).data).join(" · ");

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[#166534]" title={`Avisos: ${historico}`}>
      <Check className="w-3.5 h-3.5" aria-hidden />
      <span className="whitespace-nowrap">
        Avisada {partes(envio.data).data}
        {envio.total > 1 && <span className="text-foreground/50"> · {envio.total}x</span>}
      </span>
      <button type="button" disabled={pending} onClick={limpar} title="Apagar os avisos registrados desta cobranca"
        className="text-foreground/40 underline underline-offset-2 hover:text-foreground/70 disabled:opacity-50">
        limpar
      </button>
    </span>
  );
}

function ColunasDoPagamento({ patientId, c, onLancar, cobrar }: { patientId: string; c: CobrancaNaTela; onLancar: () => void; cobrar?: CobrarInfo }) {
  if (c.pagamento) {
    return (
      <>
        <td className="px-3 py-2"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${SITUACAO.pago.cls}`}>Pago</span></td>
        <td className="px-3 py-2 tabular-nums">{partes(c.pagamento.data).data}</td>
        <td className="px-3 py-2">{c.pagamento.pagoPor || "—"}</td>
        <td className="px-3 py-2">{c.pagamento.metodo ? PAYMENT_METHOD_LABELS[c.pagamento.metodo] ?? c.pagamento.metodo : "—"}</td>
      </>
    );
  }
  const s = SITUACAO[c.situacao];
  return (
    <>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLancar} className="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg hover:opacity-90 whitespace-nowrap">
              Lançar pagamento
            </button>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.rotulo}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <EnvioControle patientId={patientId} chave={c.chave} envio={c.envio} />
            {cobrar && <BotaoCobrar patientId={patientId} c={c} cobrar={cobrar} />}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-foreground/30">—</td>
      <td className="px-3 py-2 text-foreground/30">—</td>
      <td className="px-3 py-2 text-foreground/30">—</td>
    </>
  );
}

function FormularioDeLancamento({ patientId, c, responsavel, fechar }: { patientId: string; c: CobrancaNaTela; responsavel: string; fechar: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(fd: FormData) {
    setErro(null);
    start(async () => {
      const r = await lancarPagamento({
        patientId,
        cobrancaChave: c.chave,
        data: String(fd.get("data") ?? ""),
        pagoPor: String(fd.get("pagoPor") ?? ""),
        metodo: String(fd.get("metodo") ?? ""),
      });
      if (r.ok) { fechar(); router.refresh(); }
      else setErro(r.error ?? "Não foi possível lançar.");
    });
  }

  return (
    <tr>
      <td colSpan={8} className="px-3 pb-3">
        <form action={enviar} className="rounded-xl bg-surface/70 border border-border p-3 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto_auto] items-end" data-testid="lancar-pagamento">
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Data do pagamento</label>
            <input name="data" type="date" required defaultValue={hojeISO()} className="px-3 py-2 rounded-lg bg-white border border-border text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Responsável pelo pagamento</label>
            <input name="pagoPor" required defaultValue={responsavel} className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Forma</label>
            <select name="metodo" defaultValue="pix" className="px-3 py-2 rounded-lg bg-white border border-border text-sm">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button disabled={pending} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-60">
            {pending ? "Salvando…" : `Confirmar ${formatBRL(c.falta)}`}
          </button>
          <button type="button" onClick={fechar} className="text-foreground/50 text-sm px-2 py-2">Cancelar</button>
          {erro && <p className="sm:col-span-5 text-xs text-[#b91c1c]">{erro}</p>}
        </form>
      </td>
    </tr>
  );
}

export function GeralTab({ patientId, linhas, responsavel, cobrar, ano }: { patientId: string; linhas: LinhaNaTela[]; responsavel: string; cobrar?: CobrarInfo; ano: number }) {
  const [aberta, setAberta] = useState<string | null>(null);

  // O filtro de ano é o MESMO da tabela de pagamentos (documento de 17/09): uma escolha só, e as
  // duas tabelas respondem juntas. Filtrar aqui não apaga nada — o ano de trás continua a um
  // clique de distância.
  // A data que define o ano muda com o tipo da linha: a sessão tem a dela; o pagamento vale pelo
  // dia em que foi pago, e não pelo vencimento da cobrança que ele quitou.
  const doAnoEscolhido = doAno(linhas, ano, (l) => (l.tipo === "sessao" ? l.data : l.pagamento?.data ?? l.vencimento));

  if (!linhas.length) {
    return <div className="glass-card rounded-[24px] p-6 text-sm text-foreground/50">Nenhuma sessão registrada ainda.</div>;
  }

  if (!doAnoEscolhido.length) {
    return <div className="glass-card rounded-[24px] p-6 text-sm text-foreground/50">Nenhuma sessão em {ano}.</div>;
  }

  return (
    <div className="glass-card rounded-[24px] p-2 sm:p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="guia-geral">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-foreground/40">
              <th className="px-3 py-2 font-bold">Data / hora</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">Sessão</th>
              <th className="px-3 py-2 font-bold text-right">Valor</th>
              <th className="px-3 py-2 font-bold">Pagamento</th>
              <th className="px-3 py-2 font-bold">Pago em</th>
              <th className="px-3 py-2 font-bold">Responsável</th>
              <th className="px-3 py-2 font-bold">Forma</th>
            </tr>
          </thead>
          <tbody>
            {doAnoEscolhido.map((l) => {
              if (l.tipo === "pagamento") {
                const venc = l.vencimento ? partes(l.vencimento).data : null;
                return (
                  <Fragment key={l.chave}>
                    <tr className="border-t border-border bg-[#fef9ec]" data-chave={l.chave}>
                      <td className="px-3 py-2 tabular-nums font-semibold">{l.pagamento ? partes(l.pagamento.data).data : "__/__/__"}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">
                        <span className="font-bold text-[#92400e]">Pagamento{l.parte ? ` ${l.parte}/2` : ""}</span>
                        <span className="block text-[11px] text-foreground/50">{l.sessoes} {l.sessoes === 1 ? "sessão" : "sessões"}{venc ? ` · vence ${venc}` : ""}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold">{formatBRL(l.valor)}</td>
                      <ColunasDoPagamento patientId={patientId} c={l} onLancar={() => setAberta(l.chave)} cobrar={cobrar} />
                    </tr>
                    {aberta === l.chave && <FormularioDeLancamento patientId={patientId} c={l} responsavel={responsavel} fechar={() => setAberta(null)} />}
                  </Fragment>
                );
              }
              const p = partes(l.data);
              const c = l.cobranca;
              return (
                <Fragment key={l.id}>
                  <tr className="border-t border-border" data-sessao={l.id}>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {p.data} {p.hora}
                        {l.online ? <Video className="w-3.5 h-3.5 text-primary" aria-label="online" /> : <MapPin className="w-3.5 h-3.5 text-foreground/30" aria-label="presencial" />}
                      </span>
                    </td>
                    <CelulaStatus status={l.status} />
                    <td className="px-3 py-2 font-semibold tabular-nums">{l.rotulo || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.valor == null ? "" : formatBRL(l.valor)}</td>
                    {c ? <ColunasDoPagamento patientId={patientId} c={c} onLancar={() => setAberta(c.chave)} cobrar={cobrar} /> : <td colSpan={4} />}
                  </tr>
                  {c && aberta === c.chave && <FormularioDeLancamento patientId={patientId} c={c} responsavel={responsavel} fechar={() => setAberta(null)} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
