"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Video, X, Trash2 } from "lucide-react";
import { Check, MessageCircle } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABELS, sessionColorClasses } from "@/lib/therapy";
import type { CobrancaNaTela, LinhaNaTela } from "@/lib/geralDoPaciente";
import { montarMensagemCobranca } from "@/lib/mensagemCobranca";
import { parseMoedaBR } from "@/lib/money";
import { lancarPagamento, limparEnviosDaCobranca, registrarCobrancaEnviada, removerPagamento } from "./geral-actions";
import { marcarEmissao } from "./recibo-actions";
import { doAno } from "@/lib/filtroDeAno";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";

/** Dados para o botão "Cobrar" compor a mensagem da terapeuta. */
export type CobrarInfo = { telefone: string | null; nome: string; modelo: string | null };

/** Abre o WhatsApp com a mensagem de cobrança pronta (ou copia, se não houver telefone). */
function BotaoCobrar({ patientId, c, cobrar }: { patientId: string; c: CobrancaNaTela; cobrar: CobrarInfo }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const msg = montarMensagemCobranca(cobrar.modelo, {
    nome: cobrar.nome,
    valor: formatBRL(c.falta),
    vencimento: c.vencimento ? partes(c.vencimento).data : null,
  });
  const numero = numeroDoWhatsapp(cobrar.telefone);
  /**
   * Abre o WhatsApp E registra o aviso.
   *
   * O botao "Marcar enviada" saiu (documento de 17/09): o registro deixa de depender de alguem
   * lembrar de apertar um segundo botao. A janela abre primeiro — se o registro demorar, quem
   * cobra nao fica esperando.
   *
   * Sem telefone, ele COPIA e diz isso na tela (18/09). Antes copiava calado e marcava como
   * avisada do mesmo jeito: de fora, era igual a o botao nao ter funcionado — e o paciente
   * aparecia avisado sem ninguem ter avisado.
   */
  function acionar() {
    if (numero) {
      window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      start(async () => {
        await registrarCobrancaEnviada({ patientId, cobrancaChave: c.chave });
        router.refresh();
      });
      return;
    }
    navigator.clipboard?.writeText(msg);
    setCopiado(true);
  }
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={acionar} disabled={pending}
        title={numero ? "Cobrar pelo WhatsApp (registra o aviso)" : "Sem telefone no cadastro: copia a mensagem"}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] border border-[#a7f3d0] bg-[#ecfdf5] rounded-full px-2 py-0.5 hover:bg-[#d1fae5] disabled:opacity-60 whitespace-nowrap">
        <MessageCircle className="w-3 h-3" aria-hidden /> {pending ? "..." : "Cobrar"}
      </button>
      {copiado && (
        <span className="text-[11px] text-[#92400e]">
          Sem telefone no cadastro — mensagem copiada. Nao marquei como avisada.
        </span>
      )}
    </span>
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

/**
 * "Emitir nota" leva ao Receita Saúde, onde a emissão de fato acontece.
 *
 * O sistema não emite nota — ele encurta o caminho e ANOTA que ela foi emitida. Abrir e marcar no
 * mesmo clique é honesto aqui: quem clica está indo emitir, e a marca não é irreversível (marcar de
 * novo só regrava a hora).
 */
function BotaoNotaFiscal({ patientId, pagamentoId }: { patientId: string; pagamentoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function acionar() {
    window.open("https://receitasaude.receita.fazenda.gov.br/", "_blank", "noopener");
    start(async () => {
      await marcarEmissao({ pagamentoId, patientId, tipo: "nota" });
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={acionar} disabled={pending} title="Abrir o Receita Saúde e registrar a emissão"
      className="text-[11px] font-semibold text-foreground/70 border border-border rounded-full px-2 py-0.5 hover:bg-surface disabled:opacity-60 whitespace-nowrap">
      {pending ? "..." : "Emitir nota"}
    </button>
  );
}

/**
 * DESFAZ o lancamento do pagamento.
 *
 * A dona pediu o par completo (18/09): lancar a data marca como pago, remover a data devolve o
 * status para Em aberto ou Atrasado, conforme o vencimento.
 *
 * Pede confirmacao porque apaga registro de dinheiro: some o pagamento E a transacao do caixa.
 */
/** Remover UM lançamento (doc 22): cada pagamento da cobrança, inclusive o primeiro, tem seu X. */
function RemoverUmPagamento({ patientId, pagamentoId }: { patientId: string; pagamentoId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function acionar() {
    if (!window.confirm("Remover este pagamento? A cobrança volta a ficar em aberto e a entrada sai do caixa.")) return;
    start(async () => { const r = await removerPagamento({ pagamentoId, patientId }); if (r.ok) router.refresh(); });
  }
  return (
    <button type="button" onClick={acionar} disabled={pending} title="Remover este pagamento" aria-label="Remover este pagamento"
      className="text-[#b91c1c] hover:bg-[#fef2f2] rounded p-0.5 disabled:opacity-50">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

/**
 * Os lançamentos da cobrança, um por linha (doc 22), agora com a FORMA e o RESPONSÁVEL na própria
 * linha, antes da lixeira (doc 25) — as colunas separadas "Pago em / Responsável / Forma" saíram.
 *
 * Quanto ao VALOR (doc 25): um pagamento ÚNICO que quita o total não mostra o valor (ele é o total
 * devido, já na coluna Valor); com MAIS DE UM pagamento, cada linha mostra o seu valor, para dar
 * para identificar cada parcela.
 */
function ListaLancamentos({ patientId, pagamentos, total }: { patientId: string; pagamentos: CobrancaNaTela["pagamentos"]; total: number }) {
  if (pagamentos.length === 0) return null;
  const unicoNoTotal = pagamentos.length === 1 && Math.abs(pagamentos[0].valor - total) < 0.005;
  return (
    <div className="text-[11px] text-foreground/55 tabular-nums space-y-0.5">
      {pagamentos.map((p) => {
        const forma = p.metodo ? PAYMENT_METHOD_LABELS[p.metodo] ?? p.metodo : null;
        const partesDaLinha = [
          unicoNoTotal ? null : formatBRL(p.valor),
          partes(p.data).data,
          forma,
          p.pagoPor || null,
        ].filter(Boolean);
        return (
          <div key={p.id} className="flex items-center gap-1.5">
            <span>{partesDaLinha.join(" · ")}</span>
            <RemoverUmPagamento patientId={patientId} pagamentoId={p.id} />
          </div>
        );
      })}
    </div>
  );
}

function ColunasDoPagamento({ patientId, c, onLancar, cobrar }: { patientId: string; c: CobrancaNaTela; onLancar: () => void; cobrar?: CobrarInfo }) {
  const pg = c.pagamento;
  // Quem decide a coluna e a SITUACAO, nao a existencia de um pagamento. Desde 18/09 a cobranca
  // carrega o que ja foi recebido mesmo sem estar quitada — e meia entrada nao e "Pago".
  if (pg && c.situacao === "pago") {
    return (
      <>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Doc 26: a informação "Pago" ocupa a largura da coluna (os carimbos recibo/nota descem para a linha de baixo). */}
              <span className={`w-full text-center text-[11px] font-bold px-2 py-0.5 rounded-full ${SITUACAO.pago.cls}`}>Pago</span>
              {/* Dois carimbos independentes: quem emitiu a nota pode não ter passado recibo. */}
              {pg.recibo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857] whitespace-nowrap">recibo emitido</span>}
              {pg.nota && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#4338ca] whitespace-nowrap">nota emitida</span>}
            </div>
            {/* Quitada recebendo MENOS, com a diferença perdoada ("não haverá diferença de valor").
                Não vale quando a diferença foi TRANSFERIDA (doc 22): aí a nota de transferência já
                aparece na descrição, e não houve perdão. */}
            {c.valorDevido < c.valor && c.transferido === 0 && (
              <span className="text-[11px] text-foreground/55">
                Recebido {formatBRL(c.valorDevido)} de {formatBRL(c.valor)} · diferença perdoada
              </span>
            )}
            {/* Doc 21/22: cada lançamento aparece, sem substituir o anterior, cada um com seu remover. */}
            <ListaLancamentos patientId={patientId} pagamentos={c.pagamentos} total={c.valor} />
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/dashboard/patients/${patientId}/recibo/${pg.id}`}
                className="text-[11px] font-semibold text-primary border border-border rounded-full px-2 py-0.5 hover:bg-surface whitespace-nowrap">
                Emitir recibo
              </Link>
              <BotaoNotaFiscal patientId={patientId} pagamentoId={pg.id} />
            </div>
          </div>
        </td>
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
          {/* Pagamento parcial: a diferença aparece na PRÓPRIA linha, nunca como "pago em parte"
              (doc 17). A cobrança continua Em aberto/Em atraso; isto só diz quanto ainda falta. */}
          {pg && c.falta > 0 && (
            <div className="text-[11px] font-semibold text-[#92400e]">
              Diferença em aberto: {formatBRL(c.falta)}
            </div>
          )}
          {/* Doc 21/22: os lançamentos já feitos continuam na tela, um por linha, cada um com remover. */}
          <ListaLancamentos patientId={patientId} pagamentos={c.pagamentos} total={c.valor} />
          <div className="flex items-center gap-2 flex-wrap">
            <EnvioControle patientId={patientId} chave={c.chave} envio={c.envio} />
            {cobrar && <BotaoCobrar patientId={patientId} c={c} cobrar={cobrar} />}
          </div>
        </div>
      </td>
    </>
  );
}

function FormularioDeLancamento({ patientId, c, responsavel, responsavelCpf, fechar }: { patientId: string; c: CobrancaNaTela; responsavel: string; responsavelCpf: string; fechar: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  /**
   * O CPF acompanha o NOME de quem pagou, não o paciente.
   *
   * Por isso o campo é controlado: se quem pagou muda (o avô pagou esta, a mãe paga a próxima), o
   * CPF memorizado do outro pagador deixa de valer e o campo esvazia — repetir o CPF errado no
   * recibo é pior do que sair sem CPF nenhum.
   */
  const [nome, setNome] = useState(responsavel);
  const [cpf, setCpf] = useState(responsavelCpf);
  const mesmoPagador = nome.trim().toLowerCase() === responsavel.trim().toLowerCase();

  // Valor editável (doc 17): pré-preenchido com o que FALTA, em pt-BR. A diferença e o aviso são
  // recalculados ao vivo a partir do que a pessoa digita.
  // "Valor recebido" já no padrão monetário brasileiro enquanto digita (doc 25): os dígitos são
  // tratados como centavos e formatados em R$. O servidor parseia por `parseMoedaBR`, igual aos
  // outros campos de dinheiro (ver MoneyInput). `valorNum` é derivado para a prévia e o botão.
  const reaisBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const [valor, setValor] = useState(c.falta > 0 ? reaisBRL(c.falta) : "");
  const [quitar, setQuitar] = useState(false);
  const valorNum = Number(parseMoedaBR(valor) ?? 0) || 0;
  const diferenca = Math.round((c.falta - valorNum) * 100) / 100;
  const aMenos = diferenca > 0.005;
  const aMais = diferenca < -0.005;

  function enviar(fd: FormData) {
    setErro(null);
    start(async () => {
      const r = await lancarPagamento({
        patientId,
        cobrancaChave: c.chave,
        data: String(fd.get("data") ?? ""),
        pagoPor: String(fd.get("pagoPor") ?? ""),
        pagoPorCpf: String(fd.get("pagoPorCpf") ?? ""),
        metodo: String(fd.get("metodo") ?? ""),
        valor: String(fd.get("valor") ?? ""),
        quitarDiferenca: aMenos && quitar,
      });
      if (r.ok) { fechar(); router.refresh(); }
      else setErro(r.error ?? "Não foi possível lançar.");
    });
  }

  return (
    <tr>
      <td colSpan={5} className="px-3 pb-3">
        <form action={enviar} className="rounded-xl bg-surface/70 border border-border p-3 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-end" data-testid="lancar-pagamento">
          {/* O que ESTA cobrança cobre — para não confundir com "o valor do mês": cada cobrança é a
              sua sequência/sessões, e um mês pode ter mais de uma (ex.: pacote + sessões avulsas). */}
          {/* Doc 22: um X fecha, no canto superior ESQUERDO, ao lado do resumo (o "Cancelar" saiu). */}
          <p className="sm:col-span-7 text-[11px] text-foreground/60 -mb-1 flex items-start gap-2">
            <button type="button" onClick={fechar} aria-label="Fechar" title="Fechar"
              className="text-foreground/50 hover:text-foreground shrink-0 -mt-0.5"><X className="w-4 h-4" /></button>
            <span>
              Lançando esta cobrança: <b>{c.sessoes} {c.sessoes === 1 ? "sessão" : "sessões"}</b>
              {" · "}{formatBRL(c.valor)}
              {c.falta !== c.valor ? <> <span className="text-foreground/45">(falta {formatBRL(c.falta)})</span></> : null}
            </span>
          </p>
          <div>
            <label htmlFor="valor-pg" className="text-[11px] font-semibold text-foreground/60 block">Valor recebido</label>
            <input id="valor-pg" name="valor" inputMode="numeric" required value={valor}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setValor(d ? reaisBRL(parseInt(d, 10) / 100) : ""); }}
              className="w-[130px] px-3 py-2 rounded-lg bg-white border border-border text-sm tabular-nums" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Data do pagamento</label>
            <input name="data" type="date" required defaultValue={hojeISO()} className="px-3 py-2 rounded-lg bg-white border border-border text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Responsável pelo pagamento</label>
            <input name="pagoPor" required value={nome}
              onChange={(e) => { setNome(e.target.value); setCpf(e.target.value.trim().toLowerCase() === responsavel.trim().toLowerCase() ? responsavelCpf : ""); }}
              className="w-full px-3 py-2 rounded-lg bg-white border border-border text-sm" />
          </div>
          <div>
            <label htmlFor="pagoPorCpf" className="text-[11px] font-semibold text-foreground/60 block">
              CPF {mesmoPagador ? <span className="font-normal text-foreground/40">(opcional)</span> : <span className="font-normal text-foreground/40">de quem pagou</span>}
            </label>
            <input id="pagoPorCpf" name="pagoPorCpf" inputMode="numeric" maxLength={14} placeholder="000.000.000-00"
              value={cpf} onChange={(e) => setCpf(e.target.value)}
              className="w-[150px] px-3 py-2 rounded-lg bg-white border border-border text-sm tabular-nums" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Forma</label>
            <select name="metodo" defaultValue="pix" className="px-3 py-2 rounded-lg bg-white border border-border text-sm">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button disabled={pending} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-60">
            {pending ? "Salvando…" : `Confirmar ${formatBRL(valorNum)}`}
          </button>

          {/* Recebeu MENOS: por padrão a diferença fica em aberto; a pessoa pode optar por perdoá-la
              (doc 17 — nunca "pago em parte"). Recebeu MAIS: a sobra vira crédito. */}
          {aMenos && (
            <div className="sm:col-span-7 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1">
              {quitar ? (
                <span className="text-foreground/60">Diferença de <b>{formatBRL(diferenca)}</b> será desconsiderada — cobrança quitada.</span>
              ) : (
                <span className="text-[#92400e] font-semibold">Diferença em aberto: {formatBRL(diferenca)}</span>
              )}
              <label className="inline-flex items-center gap-1.5 text-foreground/70 cursor-pointer">
                <input type="checkbox" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} />
                Não haverá diferença de valor
              </label>
            </div>
          )}
          {aMais && (
            <p className="sm:col-span-7 text-[11px] text-foreground/60">
              {formatBRL(-diferenca)} a mais entram como crédito no saldo.
            </p>
          )}
          {erro && <p className="sm:col-span-7 text-xs text-[#b91c1c]">{erro}</p>}
        </form>
      </td>
    </tr>
  );
}

export function GeralTab({ patientId, linhas, responsavel, responsavelCpf, cobrar, ano }: { patientId: string; linhas: LinhaNaTela[]; responsavel: string; responsavelCpf?: string | null; cobrar?: CobrarInfo; ano: number }) {
  const [aberta, setAberta] = useState<string | null>(null);

  // O filtro de ano é o MESMO da tabela de pagamentos (documento de 17/09): uma escolha só, e as
  // duas tabelas respondem juntas. Filtrar aqui não apaga nada — o ano de trás continua a um
  // clique de distância.
  // A data que define o ano muda com o tipo da linha: a sessão tem a dela; o pagamento vale pelo
  // dia em que foi pago, e não pelo vencimento da cobrança que ele quitou.
  const doAnoEscolhido = doAno(linhas, ano, (l) => (l.tipo === "sessao" || l.tipo === "bloqueio" ? l.data : l.pagamento?.data ?? l.vencimento));

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
              <th className="px-3 py-2 font-bold">Sessão</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold text-right">Valor</th>
              <th className="px-3 py-2 font-bold">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {doAnoEscolhido.map((l) => {
              if (l.tipo === "pagamento") {
                const venc = l.vencimento ? partes(l.vencimento).data : null;
                return (
                  <Fragment key={l.chave}>
                    <tr className="border-t border-border bg-[#fef9ec]" data-chave={l.chave}>
                      {/* Doc 26: a data de pagamento saiu da coluna Data/hora — ela já aparece nos dados do
                          pagamento (célula Pagamento). E o descritor da cobrança ocupa as colunas Sessão+Status. */}
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" colSpan={2}>
                        {/* A quinzena tem nome, nao numero: uma cobranca sozinha marcada "2/2" parece que perdeu a outra
                            — e desde 17/09 a quinzena sem atendimento nao gera linha nenhuma. */}
                        <span className="font-bold text-[#92400e]">Pagamento{l.parte ? ` · ${l.parte === 2 ? "2ª" : "1ª"} quinzena` : ""}</span>
                        {/* Doc 22: a linha do pagamento mostra só o vencimento — NÃO as datas das sessões
                            (o detalhe por data saiu; a quinzena exibe apenas a data de vencimento). */}
                        <span className="block text-[11px] text-foreground/50">{l.sessoes} {l.sessoes === 1 ? "sessão" : "sessões"}{venc ? ` · vence ${venc}` : ""}</span>
                        {/* Doc 22: diferença de um pacote anterior que foi somada a este. */}
                        {l.arrastoRecebido > 0 && (
                          <span className="block text-[11px] text-[#92400e]/80">inclui {formatBRL(l.arrastoRecebido)} de diferença do pacote anterior ({formatBRL(l.valorBase)} + {formatBRL(l.arrastoRecebido)})</span>
                        )}
                        {/* Doc 22: pacote encerrado cuja diferença rolou para a próxima cobrança. */}
                        {l.transferido > 0 && (
                          <span className="block text-[11px] text-[#92400e]/80">{formatBRL(l.transferido)} transferido para a próxima cobrança do pacote</span>
                        )}
                      </td>
                      {/* Doc 21: havendo pagamento, a coluna Valor mostra o que foi EFETIVAMENTE pago
                          (e, abaixo, o previsto quando ainda falta). Sem pagamento, mostra o previsto. */}
                      <td className="px-3 py-2 text-right tabular-nums font-bold">
                        {formatBRL(l.pagamentos.length > 0 ? l.valorPago : l.valor)}
                        {l.pagamentos.length > 0 && l.falta > 0 && (
                          <span className="block text-[10px] font-normal text-foreground/45">de {formatBRL(l.valor)}</span>
                        )}
                      </td>
                      <ColunasDoPagamento patientId={patientId} c={l} onLancar={() => setAberta(l.chave)} cobrar={cobrar} />
                    </tr>
                    {aberta === l.chave && <FormularioDeLancamento patientId={patientId} c={l} responsavel={responsavel} responsavelCpf={responsavelCpf ?? ""} fechar={() => setAberta(null)} />}
                  </Fragment>
                );
              }
              /*
               * HORARIO BLOQUEADO (dona, 19/09). A data em que a serie NAO pode ser marcada
               * continua na tabela — "para que o historico e a sequencia do pacote nao sejam
               * perdidos" — mas nao e sessao: sem posicao no pacote, sem valor, sem clique.
               * Some sozinha quando o horario for desbloqueado.
               */
              if (l.tipo === "bloqueio") {
                const b = partes(l.data);
                return (
                  <tr key={`bloq-${l.data}`} className="border-t border-border bg-surface/40 text-foreground/50">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.data} {b.hora}</td>
                    <td className="px-3 py-2 text-foreground/30">—</td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#991b1b] whitespace-nowrap">Hor. Bloq.</span>
                    </td>
                    <td className="px-3 py-2 text-foreground/30">—</td>
                    <td className="px-3 py-2 text-foreground/30">—</td>
                  </tr>
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
                    <td className="px-3 py-2 font-semibold tabular-nums">{l.rotulo || "—"}</td>
                    <CelulaStatus status={l.status} />
                    <td className="px-3 py-2 text-right tabular-nums">{l.valor == null ? "" : formatBRL(l.valor)}</td>
                    {c ? <ColunasDoPagamento patientId={patientId} c={c} onLancar={() => setAberta(c.chave)} cobrar={cobrar} /> : <td />}
                  </tr>
                  {c && aberta === c.chave && <FormularioDeLancamento patientId={patientId} c={c} responsavel={responsavel} responsavelCpf={responsavelCpf ?? ""} fechar={() => setAberta(null)} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
