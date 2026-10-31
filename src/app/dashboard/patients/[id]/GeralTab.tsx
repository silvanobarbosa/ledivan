"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, Video, X, Trash2, Pencil, Undo2 } from "lucide-react";
import { Check, MessageCircle } from "lucide-react";
import { formatBRL, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS, sessionColorClasses } from "@/lib/therapy";
import type { CobrancaNaTela, LinhaNaTela } from "@/lib/geralDoPaciente";
import { montarMensagemCobranca } from "@/lib/mensagemCobranca";
import { parseMoedaBR } from "@/lib/money";
import { mascaraMoeda } from "@/lib/mascaraMoeda";
import { PARCELAS_CREDITO, metodoDoCredito, rotuloDaParcela } from "@/lib/parcelaCredito";
import { aplicarCreditoNoLancamento } from "@/lib/credito";
import { creditoParaAbater, perguntaDoLancamento } from "@/lib/creditoAConfirmar";
import { desfazerVencimento, editarValorDaSessao, editarVencimento, lancarPagamento, limparEnviosDaCobranca, registrarCobrancaEnviada, removerPagamento } from "./geral-actions";
import { marcarEmissao } from "./recibo-actions";
import { doAno, dataDoAnoControle } from "@/lib/filtroDeAno";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { useConfirmarEnvio, ConfirmarEnvioModal } from "@/components/dashboard/confirmarEnvio";

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
  // Doc 47: abrir o WhatsApp NÃO registra; a confirmação explícita no retorno é que registra.
  // Sem telefone, só COPIA e avisa (18/09) — não registra e não pergunta.
  const confirmar = useConfirmarEnvio<string>();
  function acionar() {
    if (numero) {
      confirmar.abrir(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, c.chave);
      return;
    }
    navigator.clipboard?.writeText(msg);
    setCopiado(true);
  }
  function registrar(chave: string) {
    start(async () => { await registrarCobrancaEnviada({ patientId, cobrancaChave: chave }); router.refresh(); });
  }
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={acionar} disabled={pending}
        title={numero ? "Cobrar pelo WhatsApp" : "Sem telefone no cadastro: copia a mensagem"}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] border border-[#a7f3d0] bg-[#ecfdf5] rounded-full px-2 py-0.5 hover:bg-[#d1fae5] disabled:opacity-60 whitespace-nowrap">
        <MessageCircle className="w-3 h-3" aria-hidden /> {pending ? "..." : "Cobrar"}
      </button>
      {copiado && (
        <span className="text-[11px] text-[#92400e]">
          Sem telefone no cadastro — mensagem copiada. Nao marquei como avisada.
        </span>
      )}
      <ConfirmarEnvioModal aberto={confirmar.pendente != null} web={confirmar.web} onSim={() => confirmar.resolver(true, registrar)} onNao={() => confirmar.resolver(false, registrar)} />
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
// Doc 36: o dia da semana (SEG…DOM) vai à ESQUERDA da data na guia Geral. Vem dos COMPONENTES UTC
// da data de parede — getDay local jogaria o dia num fuso negativo (ver lição meia-noite).
const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const partes = (t: string) => {
  const [d, h = ""] = t.split("T");
  const [a, m, dia] = d.split("-");
  const dow = DIAS_SEMANA[new Date(Date.UTC(+a, +m - 1, +dia)).getUTCDay()] ?? "";
  return { data: `${dia}/${m}/${a.slice(2)}`, hora: h.slice(0, 5), dia: dow };
};

/**
 * Doc 31: o vencimento de uma cobrança é EDITÁVEL à mão ENQUANTO o pagamento não foi lançado. Mostra
 * "· vence dd/mm" com um lápis ao lado; clicar abre um campo de data; salvar grava o override (não
 * mexe no valor nem nas outras cobranças). Editado, aparece o "desfazer", que volta à data calculada.
 */
/**
 * O LÁPIS AO LADO DO VALOR DE CADA SESSÃO (doc 62).
 *
 * Aparece só onde a sessão tem valor próprio — a cobrança "a cada sessão" e a avulsa. No pacote o
 * valor é do pacote inteiro, e um lápis ali prometeria uma edição que o motor não leria.
 */
function ValorEditavel({ patientId, sessionId, valor }: { patientId: string; sessionId: string; valor: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(() => mascaraMoeda(String(Math.round(valor * 100))));
  const [erro, setErro] = useState<string | null>(null);

  const salvar = () =>
    start(async () => {
      const r = await editarValorDaSessao({ patientId, sessionId, valor: texto });
      if (r.ok) { setEditando(false); setErro(null); router.refresh(); }
      else setErro(r.error ?? "Não deu para salvar.");
    });

  if (editando) {
    return (
      <span className="inline-flex flex-col items-end gap-0.5 print:hidden" data-testid="editar-valor">
        <span className="inline-flex items-center gap-1">
          <input inputMode="numeric" value={texto} autoFocus aria-label="Valor desta sessão"
            onChange={(e) => setTexto(mascaraMoeda(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvar(); } if (e.key === "Escape") setEditando(false); }}
            className="w-[110px] rounded border border-border px-1 py-0.5 text-[11px] bg-white tabular-nums text-right" />
          <button type="button" onClick={salvar} disabled={pending} aria-label="Salvar valor da sessão" className="text-[#166534] disabled:opacity-50 cursor-pointer">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => { setEditando(false); setErro(null); }} aria-label="Cancelar" className="text-foreground/40 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
        {erro && <span className="text-[10px] font-normal text-[#b91c1c]">{erro}</span>}
      </span>
    );
  }

  return (
    <button type="button" onClick={() => setEditando(true)} title="Editar o valor desta sessão"
      aria-label="Editar o valor desta sessão"
      className="text-foreground/30 hover:text-primary transition ml-1 align-middle print:hidden cursor-pointer">
      <Pencil className="w-3 h-3" />
    </button>
  );
}

function VencimentoEditavel({ patientId, c }: { patientId: string; c: CobrancaNaTela }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(c.vencimento ? c.vencimento.slice(0, 10) : "");
  const [erro, setErro] = useState<string | null>(null);
  const [perguntaMes, setPerguntaMes] = useState(false);
  const venc = c.vencimento ? partes(c.vencimento).data : null;
  const podeEditar = c.pagamentos.length === 0;

  // Doc 33: pago o valor TOTAL, o "· vence dd/mm" some — não faz mais sentido mostrar prazo de algo quitado.
  if (!venc || c.situacao === "pago") return null;

  // Doc 45: só pergunta das "próximas parcelas" quando o MÊS muda (dia/ano iguais segue direto).
  const mesMudou = () => { const antigo = c.vencimento?.slice(0, 7); return !!antigo && valor.slice(0, 7) !== antigo; };
  const gravar = (proximasTambem: boolean) => {
    setPerguntaMes(false);
    start(async () => {
      const r = await editarVencimento({ patientId, cobrancaChave: c.chave, data: valor, proximasTambem });
      if (r.ok) { setEditando(false); setErro(null); router.refresh(); }
      else setErro(r.error ?? "Não deu para salvar.");
    });
  };
  const salvar = () => {
    if (!valor) { setErro("Escolha a data."); return; }
    if (mesMudou()) { setPerguntaMes(true); return; }
    gravar(false);
  };
  const desfazer = () =>
    start(async () => {
      const r = await desfazerVencimento({ patientId, cobrancaChave: c.chave });
      if (r.ok) router.refresh();
    });

  if (editando) {
    return (
      <span className="inline-flex items-center gap-1 ml-1 align-middle">
        <input
          type="date"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="rounded border border-border px-1 py-0.5 text-[11px] bg-white"
          autoFocus
        />
        <button type="button" onClick={salvar} disabled={pending} aria-label="Salvar vencimento" className="text-[#166534] disabled:opacity-50 cursor-pointer">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => { setEditando(false); setErro(null); setValor(c.vencimento ? c.vencimento.slice(0, 10) : ""); }}
          aria-label="Cancelar"
          className="text-foreground/40 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {erro && <span className="text-[10px] text-[#991b1b]">{erro}</span>}
        {perguntaMes && (
          <span className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={() => setPerguntaMes(false)}>
            <span className="block bg-white rounded-[20px] p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <span className="block font-display text-base font-bold text-primary">Deseja alterar o mês de vencimento das próximas parcelas também?</span>
              <span className="block text-xs text-foreground/60 mt-1">Sim desloca o mês das próximas parcelas (sem pagamento), mantendo os dias e anos. Não altera só esta.</span>
              <span className="flex gap-2 mt-4">
                <button type="button" disabled={pending} onClick={() => gravar(true)} className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold disabled:opacity-60">Sim</button>
                <button type="button" disabled={pending} onClick={() => gravar(false)} className="flex-1 bg-surface text-foreground/70 py-2 rounded-xl text-sm font-bold disabled:opacity-60">Não</button>
              </span>
            </span>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {` · vence ${venc}`}
      {podeEditar && (
        <>
          <button type="button" onClick={() => setEditando(true)} aria-label="Editar vencimento" title="Editar vencimento" className="text-foreground/40 hover:text-foreground cursor-pointer">
            <Pencil className="w-3 h-3" />
          </button>
          {c.vencimentoEditado && (
            <button type="button" onClick={desfazer} disabled={pending} aria-label="Desfazer edição do vencimento" title="Voltar à data calculada" className="text-foreground/40 hover:text-foreground disabled:opacity-50 cursor-pointer">
              <Undo2 className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </span>
  );
}

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
/**
 * As formas do seletor. "Crédito" aparece UMA vez; o parcelamento é a pergunta seguinte.
 * Derivada de PAYMENT_METHOD_OPTIONS para não virar uma segunda lista: tira as parcelas
 * (`credito_Nx`) e mantém o resto na ordem original.
 */
const FORMAS_BASE = PAYMENT_METHOD_OPTIONS
  .filter((o) => !/^credito_\d+x$/.test(o.value))
  .map((o) => (o.value === "credito" ? { value: o.value, label: "Crédito" } : o));

const STATUS_GERAL: Record<string, string> = {
  realizada: "Presente", nao_realizada: "Faltou", cancelada: "Desmarcou",
  realocada: "Desmarcou", prof_desmarcou: "Prof. desm.", atestado: "Atestado",
};
/**
 * Doc 52: a guia Geral deixa de PERGUNTAR e passa a MOSTRAR.
 *
 * A decisão de cobrar ou abater já é tomada na agenda, no momento em que a falta é registrada —
 * e lá a pergunta é a do tipo do agendamento. Repeti-la aqui criava dois controles para o mesmo
 * dado, cada um com um texto, e nada dizia qual tinha valido por último.
 *
 * Para mudar de ideia: abrir o agendamento na agenda e escolher "Faltou" de novo. A pergunta
 * reaparece e a nova resposta SUBSTITUI a anterior — não soma.
 */
function CelulaStatus({ status }: { status?: string | null }) {
  const rotulo = status ? STATUS_GERAL[status] : undefined;
  if (!rotulo || !status) return <td className="px-3 py-2" />;
  // Doc 33: conteúdo centralizado e a cor de fundo do status ocupa a largura toda da coluna.
  return (
    <td className="px-3 py-2">
      <span className={`block w-full text-center text-[11px] font-bold px-2 py-0.5 rounded-md border ${sessionColorClasses(status)}`}>{rotulo}</span>
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

  const limpar = () => {
    if (!confirm("Apagar os avisos registrados desta cobrança?")) return;
    start(async () => {
      const r = await limparEnviosDaCobranca({ patientId, cobrancaChave: chave });
      if (r.ok) router.refresh();
    });
  };

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
      className="text-[#b91c1c] hover:bg-[#fef2f2] rounded p-0.5 disabled:opacity-50 print:hidden">
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
  // Doc 29 — ordem de CADA lançamento (igual no total e no parcial):
  //  1) [valor ·] data · forma · lixeira   2) responsável   3) carimbos recibo/nota   4) botões.
  // A única diferença: o pagamento que cobre o pacote inteiro NÃO mostra o valor; o parcial mostra.
  return (
    <div className="text-[11px] text-foreground/55 tabular-nums space-y-2">
      {pagamentos.map((p) => {
        // Doc 62: o abatimento mostra a FORMA junto de "Crédito do saldo" — a forma do dinheiro
        // que originou o crédito. Só "Crédito do saldo" não diz como o paciente pagou, e é o que
        // ela confere contra o extrato: "R$ 50,00 · 27/10/26 · Pix · Crédito do saldo".
        const nomeDaForma = p.metodo ? PAYMENT_METHOD_LABELS[p.metodo] ?? p.metodo : null;
        const forma = p.credito ? [nomeDaForma, "Crédito do saldo"].filter(Boolean).join(" · ") : nomeDaForma;
        const ehTotal = Math.abs(p.valor - total) < 0.005; // paga o pacote inteiro → oculta o valor
        const linha1 = [ehTotal ? null : formatBRL(p.valor), partes(p.data).data, forma].filter(Boolean).join(" · ");
        return (
          <div key={p.id} className="space-y-0.5">
            {/* 1ª linha: [valor ·] data · forma · lixeira (em negrito — campos do sistema) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-foreground/70">{linha1}</span>
              <RemoverUmPagamento patientId={patientId} pagamentoId={p.id} />
            </div>
            {/* 2ª linha: responsável pelo pagamento */}
            {p.pagoPor ? <div className="text-foreground/55">{p.pagoPor}</div> : null}
            {/* Carimbos (depois do responsável): recibo emitido / nota emitida, quando houver */}
            {(p.recibo || p.nota) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {p.recibo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857] whitespace-nowrap">recibo emitido</span>}
                {p.nota && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#4338ca] whitespace-nowrap">nota emitida{p.reciboNumero ? ` — nº ${p.reciboNumero}` : ""}</span>}
              </div>
            )}
            {/* Botões: Emitir recibo / Emitir nota (ações — fora do PDF, doc 30) */}
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              <Link href={`/dashboard/patients/${patientId}/recibo/${p.id}`}
                className="text-[11px] font-semibold text-primary border border-border rounded-full px-2 py-0.5 hover:bg-surface whitespace-nowrap">
                Emitir recibo
              </Link>
              <BotaoNotaFiscal patientId={patientId} pagamentoId={p.id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ColunasDoPagamento({ patientId, c, onLancar, cobrar, aviso }: { patientId: string; c: CobrancaNaTela; onLancar: () => void; cobrar?: CobrarInfo; aviso?: string | null }) {
  const pg = c.pagamento;
  // Quem decide a coluna e a SITUACAO, nao a existencia de um pagamento. Desde 18/09 a cobranca
  // carrega o que ja foi recebido mesmo sem estar quitada — e meia entrada nao e "Pago".
  // Doc 29: a ordem (data/forma/lixeira · responsável · carimbos · botões) é toda por lançamento,
  // dentro de ListaLancamentos — aqui fica só o status "Pago" e o aviso de diferença perdoada.
  if (pg && c.situacao === "pago") {
    // Doc 30: no pagamento TOTAL a lista de lançamentos às vezes vem vazia (o pagamento existe só
    // como representante `c.pagamento`). Sem fallback, a linha some inteira — data/forma/lixeira/
    // botões não aparecem. Então, se não há lista, sintetizamos um lançamento a partir do
    // representante, com o valor da cobrança (que o ListaLancamentos oculta por ser o total).
    const lancamentos = c.pagamentos.length
      ? c.pagamentos
      : [{ id: pg.id, data: pg.data, valor: c.valor, pagoPor: pg.pagoPor, metodo: pg.metodo, recibo: pg.recibo, nota: pg.nota, reciboNumero: pg.reciboNumero, credito: pg.credito }];
    return (
      <>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1.5">
            {/* Doc 60: o aviso da conversão CONTINUA depois de pago. Ele some do lugar em que a
                terapeuta foi olhar justamente quando ela acabou de agir — e aí a sessão gratuita
                aparece cobrando dinheiro sem nada que explique por quê. */}
            {aviso && <div className="text-[11px] text-foreground/50">{aviso}</div>}
            {/* Status "Pago" ocupa a largura da coluna. */}
            <span className={`w-full text-center text-[11px] font-bold px-2 py-0.5 rounded-full ${SITUACAO.pago.cls}`}>Pago</span>
            {/* Quitada recebendo MENOS, com a diferença perdoada ("não haverá diferença de valor").
                Não vale quando a diferença foi TRANSFERIDA (doc 22): aí a nota de transferência já
                aparece na descrição, e não houve perdão. */}
            {c.valorDevido < c.valor && c.transferido === 0 && (
              <span className="text-[11px] text-foreground/55">
                Recebido {formatBRL(c.valorDevido)} de {formatBRL(c.valor)} · diferença perdoada
              </span>
            )}
            {/* Cada lançamento, na ordem do doc 29 (valor[parcial]·data·forma·lixeira / responsável /
                carimbos / botões). Com fallback do representante no total (doc 30). */}
            <ListaLancamentos patientId={patientId} pagamentos={lancamentos} total={c.valor} />
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
          {/* Doc 57: EM CIMA do botão. É onde a terapeuta vai agir, e o texto explica por que uma
              sessão de paciente gratuito está pedindo dinheiro. */}
          {aviso && <div className="text-[11px] text-foreground/50">{aviso}</div>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLancar} className="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg hover:opacity-90 whitespace-nowrap print:hidden">
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
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <EnvioControle patientId={patientId} chave={c.chave} envio={c.envio} />
            {cobrar && <BotaoCobrar patientId={patientId} c={c} cobrar={cobrar} />}
          </div>
        </div>
      </td>
    </>
  );
}

/**
 * A PERGUNTA DO ABATIMENTO, ANTES DO FORMULÁRIO (doc 61).
 *
 * "Ao clicar em Lançar pagamento, o sistema deverá abrir uma janela: Deseja abater o crédito de
 * R$ XX,XX deste pagamento?" Ela só aparece sobre o crédito que ficou marcado numa conversão
 * GRAT→AVUL recusada; o resto do saldo continua abatendo sozinho, como o doc 36 definiu, e o
 * documento é explícito em não estender esta confirmação a outras situações.
 *
 * A pergunta mora FORA do formulário de propósito: é a resposta que decide quanto crédito abate, e
 * o campo "Valor recebido" nasce pré-preenchido com o dinheiro que falta DEPOIS do abatimento.
 * Dentro, o formulário teria de nascer com um número e trocá-lo depois — e número que muda sozinho
 * num campo de dinheiro é o começo de um lançamento errado.
 *
 * Respondido "Não", nada se grava: a pergunta volta no próximo lançamento, com o saldo atualizado,
 * até o crédito acabar.
 */
function Lancamento({ patientId, c, responsavel, responsavelCpf, fechar, creditoDisponivel: saldoTotal = 0, creditoAConfirmar = 0 }: { patientId: string; c: CobrancaNaTela; responsavel: string; responsavelCpf: string; fechar: () => void; creditoDisponivel?: number; creditoAConfirmar?: number }) {
  const [usarCredito, setUsarCredito] = useState<boolean | null>(creditoAConfirmar > 0.005 ? null : false);
  if (usarCredito === null) {
    return (
      <tr>
        <td colSpan={5} className="px-3 pb-3">
          <div className="rounded-xl bg-surface/70 border border-border p-3 flex flex-wrap items-center gap-3" data-testid="perguntar-credito">
            <span className="text-sm font-semibold text-foreground/80">{perguntaDoLancamento(creditoAConfirmar)}</span>
            <button type="button" onClick={() => setUsarCredito(true)}
              className="bg-primary text-white px-4 py-1.5 rounded-lg font-bold text-sm">Sim</button>
            <button type="button" onClick={() => setUsarCredito(false)}
              className="bg-white border border-border text-foreground/70 px-4 py-1.5 rounded-lg font-bold text-sm">Não</button>
            <button type="button" onClick={fechar} className="text-[11px] text-foreground/40 ml-auto">Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <FormularioDeLancamento patientId={patientId} c={c} responsavel={responsavel} responsavelCpf={responsavelCpf}
      fechar={fechar} usarCredito={usarCredito} saldoTotal={saldoTotal}
      creditoDisponivel={creditoParaAbater({ disponivel: saldoTotal, aConfirmar: creditoAConfirmar, usar: usarCredito })} />
  );
}

function FormularioDeLancamento({ patientId, c, responsavel, responsavelCpf, fechar, creditoDisponivel = 0, saldoTotal = 0, usarCredito = false }: { patientId: string; c: CobrancaNaTela; responsavel: string; responsavelCpf: string; fechar: () => void; creditoDisponivel?: number; saldoTotal?: number; usarCredito?: boolean }) {
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
  /**
   * Doc 68: a diferença fica nesta cobrança (padrão) ou rola para o próximo pacote.
   *
   * Nasce em "fica" porque é o destino que não surpreende: lançar menos e ver a cobrança fechada
   * como "Paga", com o saldo em outro lugar, é o que confunde — e era o único comportamento.
   */
  const [diferencaFica, setDiferencaFica] = useState(true);
  const [nome, setNome] = useState(responsavel);
  const [cpf, setCpf] = useState(responsavelCpf);
  const [formaBase, setFormaBase] = useState("pix");
  const [parcelas, setParcelas] = useState(1);
  const mesmoPagador = nome.trim().toLowerCase() === responsavel.trim().toLowerCase();

  // Valor editável (doc 17): pré-preenchido com o que FALTA, em pt-BR. A diferença e o aviso são
  // recalculados ao vivo a partir do que a pessoa digita.
  // "Valor recebido" já no padrão monetário brasileiro enquanto digita (doc 25): os dígitos são
  // tratados como centavos e formatados em R$. O servidor parseia por `parseMoedaBR`, igual aos
  // outros campos de dinheiro (ver MoneyInput). `valorNum` é derivado para a prévia e o botão.
  // O valor inicial sai da MESMA máscara que o campo usa ao digitar. Com duas formatações, o
  // campo nascia com um espaço e passava a usar outro na primeira tecla — diferença invisível na
  // tela, mas é como as duas regras começam a divergir.
  const comoMascara = (n: number) => mascaraMoeda(String(Math.round(n * 100)));
  // Doc 36: havendo crédito no saldo, ele já abate — o campo pré-preenche com o DINHEIRO que falta
  // depois do crédito, e a sobra (pagar a mais) pode virar crédito novo (o usuário decide).
  const [valor, setValor] = useState(() => {
    const faltaAposCredito = Math.max(0, Math.round((c.falta - Math.min(creditoDisponivel, c.falta)) * 100) / 100);
    return faltaAposCredito > 0 ? comoMascara(faltaAposCredito) : "";
  });
  const [quitar, setQuitar] = useState(false);
  const [creditarSobra, setCreditarSobra] = useState(true);
  const valorNum = Number(parseMoedaBR(valor) ?? 0) || 0;
  /**
   * A COBRANÇA QUE AINDA ESPERA O VALOR (doc 60).
   *
   * A falta do paciente gratuito nasce AVUL de R$ 0,00 por desenho (doc 54): o valor é definido
   * depois. Até aqui, contra uma cobrança de zero, tudo o que a terapeuta digitava era "a mais", e
   * a tela perguntava se os R$ 50,00 deviam virar crédito no saldo — "se o usuário clicou em
   * lançar pagamento e não tem nenhum valor digitado, significa que esse valor irá entrar para
   * essa sessão", respondeu o dono. É o que acontece agora: o valor digitado É o da sessão.
   */
  const aguardandoValor = c.aguardandoValor === true && c.falta <= 0.005;
  const faltaDaCobranca = aguardandoValor ? valorNum : c.falta;
  const { creditoAplicado, fecha } = aplicarCreditoNoLancamento({
    falta: faltaDaCobranca, cashRecebido: valorNum, creditoDisponivel, creditarExcedente: creditarSobra,
  });
  // Ainda falta DEPOIS do dinheiro + crédito aplicado? Então é pagamento parcial (recebeu menos).
  const diferenca = Math.round((faltaDaCobranca - valorNum - creditoAplicado) * 100) / 100;
  const aMenos = !fecha && diferenca > 0.005;
  const sobraCash = Math.round((valorNum - faltaDaCobranca) * 100) / 100;
  const aMais = sobraCash > 0.005;
  /**
   * O CRÉDITO COBRE TUDO: não há dinheiro a receber, e o botão confirma assim mesmo (doc 61).
   *
   * Antes o campo era obrigatório e nascia vazio justamente neste caso — a cobrança quitada pelo
   * saldo não tinha como ser lançada, e o crédito que ela pediu para usar ficava preso.
   */
  const soCredito = valorNum <= 0.005 && creditoAplicado > 0.005 && !aguardandoValor;

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
        // Só crédito: o campo fica vazio, e vazio significaria "o que falta" no servidor — que é
        // justamente o valor que o crédito acabou de cobrir. O zero precisa ser dito (doc 61).
        valor: soCredito ? "0" : String(fd.get("valor") ?? ""),
        quitarDiferenca: aMenos && quitar,
        diferencaOutraData: aMenos && !quitar && diferencaFica,
        creditarExcedente: aMais && creditarSobra,
        usarCredito,
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
            {/* A regra da máscara mora em `mascaraMoeda`, uma só para o app inteiro — ela estava
                copiada aqui, no MoneyInput e na janela da falta. Três cópias é o caminho para elas
                divergirem num detalhe de centavo sem ninguém perceber. */}
            <input id="valor-pg" name="valor" inputMode="numeric" required={!soCredito} value={valor}
              onChange={(e) => setValor(mascaraMoeda(e.target.value))}
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
          {/* Doc 53: a forma pergunta primeiro "foi no crédito?" e só então "em quantas vezes".
              Antes as parcelas vinham soltas na mesma lista, junto de Pix e Dinheiro — o que
              misturava duas perguntas diferentes e crescia a cada parcela nova.
              O que vai ao servidor continua sendo UMA string (`metodo`), montada por
              `metodoDoCredito`: o server action não muda. */}
          <div>
            <label className="text-[11px] font-semibold text-foreground/60 block">Forma</label>
            <select value={formaBase} onChange={(e) => setFormaBase(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-border text-sm">
              {FORMAS_BASE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {formaBase === "credito" && (
            <div>
              <label className="text-[11px] font-semibold text-foreground/60 block">Parcelas</label>
              <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
                className="px-3 py-2 rounded-lg bg-white border border-border text-sm">
                {PARCELAS_CREDITO.map((n) => <option key={n} value={n}>{rotuloDaParcela(n)}</option>)}
              </select>
            </div>
          )}
          <input type="hidden" name="metodo" value={formaBase === "credito" ? metodoDoCredito(parcelas) : formaBase} />
          <button disabled={pending} className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-60">
            {pending ? "Salvando…" : soCredito ? `Confirmar com o crédito (${formatBRL(creditoAplicado)})` : `Confirmar ${formatBRL(valorNum)}`}
          </button>

          {/* Doc 36: crédito do saldo disponível — abatido automaticamente nesta cobrança. */}
          {/* Doc 61: o saldo mostrado é o INTEIRO, mesmo quando a resposta foi "Não". Mostrar só o
              que abate aqui faria o crédito recusado sumir da tela — e ele continua do paciente. */}
          {Math.max(saldoTotal, creditoDisponivel) > 0.005 && (
            <p className="sm:col-span-7 text-[11px] text-[#047857]">
              Crédito no saldo: <b>{formatBRL(Math.max(saldoTotal, creditoDisponivel))}</b>
              {creditoAplicado > 0.005
                ? <> — <b>{formatBRL(creditoAplicado)}</b> será aplicado nesta cobrança.</>
                : usarCredito ? " (não necessário aqui)." : " — não será abatido neste pagamento."}
            </p>
          )}

          {/* Recebeu MENOS: por padrão a diferença fica em aberto; a pessoa pode optar por perdoá-la
              (doc 17 — nunca "pago em parte"). */}
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
              {/* Doc 68: e, quando a diferença CONTINUA existindo, para onde ela vai.
                  São destinos opostos: rolando, esta cobrança fecha e o saldo some para o pacote
                  seguinte — e com ela some o botão de lançar o resto. Ficando, ela espera aqui. */}
              {!quitar && (
                <div className="w-full flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-foreground/60">E a diferença?</span>
                  <div className="inline-flex rounded-lg overflow-hidden border border-border">
                    <button type="button" onClick={() => setDiferencaFica(true)}
                      className={`px-3 py-1 font-bold transition ${diferencaFica ? "bg-[#92400e] text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                      Será lançada em outra data
                    </button>
                    <button type="button" onClick={() => setDiferencaFica(false)}
                      className={`px-3 py-1 font-bold transition border-l border-border ${!diferencaFica ? "bg-[#92400e] text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                      Jogar para o próximo pacote
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Recebeu MAIS: o usuário DECIDE se a sobra vira crédito no saldo. Doc 38: o checkbox
              confundia — virou pergunta com Sim/Não explícito. */}
          {aMais && (
            <div className="sm:col-span-7 text-[11px] flex flex-wrap items-center gap-2">
              <span className="text-foreground/70">{formatBRL(sobraCash)} a mais entram como crédito no saldo?</span>
              <div className="inline-flex rounded-lg overflow-hidden border border-border">
                <button type="button" onClick={() => setCreditarSobra(true)}
                  className={`px-3 py-1 font-bold transition ${creditarSobra ? "bg-[#047857] text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                  Sim
                </button>
                <button type="button" onClick={() => setCreditarSobra(false)}
                  className={`px-3 py-1 font-bold transition border-l border-border ${!creditarSobra ? "bg-[#b91c1c] text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}>
                  Não
                </button>
              </div>
            </div>
          )}
          {erro && <p className="sm:col-span-7 text-xs text-[#b91c1c]">{erro}</p>}
        </form>
      </td>
    </tr>
  );
}

export function GeralTab({ patientId, linhas, responsavel, responsavelCpf, cobrar, ano, creditoDisponivel = 0, creditoAConfirmar = 0 }: { patientId: string; linhas: LinhaNaTela[]; responsavel: string; responsavelCpf?: string | null; cobrar?: CobrarInfo; ano: number | "TODOS"; creditoDisponivel?: number; creditoAConfirmar?: number }) {
  const [aberta, setAberta] = useState<string | null>(null);

  // O filtro de ano é o MESMO da tabela de pagamentos (documento de 17/09): uma escolha só, e as
  // duas tabelas respondem juntas. Filtrar aqui não apaga nada — o ano de trás continua a um
  // clique de distância.
  // A data que define o ano muda com o tipo da linha (doc 32): a sessão tem a dela; o CABEÇALHO do
  // pagamento vale pelo VENCIMENTO — para o pacote que cruza o ano aparecer com as sessões do ano em
  // que começou, e as do ano seguinte caírem no ano seguinte (ver `dataDoAnoControle`).
  // Doc 30: "TODOS" (ano = "TODOS") mostra todos os anos — passa `null` para o filtro (que devolve tudo).
  const doAnoEscolhido = doAno(linhas, ano === "TODOS" ? null : ano, dataDoAnoControle);

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
              <th className="px-3 py-2 font-bold text-center">Sessão</th>
              <th className="px-3 py-2 font-bold text-center">Status</th>
              <th className="px-3 py-2 font-bold text-right">Valor</th>
              <th className="px-3 py-2 font-bold">Pagamento</th>
            </tr>
          </thead>
          <tbody>
            {doAnoEscolhido.map((l) => {
              if (l.tipo === "pagamento") {
                return (
                  <Fragment key={l.chave}>
                    <tr className="border-t border-border bg-[#fef9ec]" data-chave={l.chave}>
                      {/* Doc 27: o descritor "Pagamento · X sessões · vence" mescla as 3 primeiras colunas
                          (Data/hora + Sessão + Status). A data de pagamento vive nos dados do pagamento. */}
                      <td className="px-3 py-2" colSpan={3}>
                        {/* A quinzena tem nome, nao numero: uma cobranca sozinha marcada "2/2" parece que perdeu a outra
                            — e desde 17/09 a quinzena sem atendimento nao gera linha nenhuma. */}
                        <span className="font-bold text-[#92400e]">Pagamento{l.parte ? ` · ${l.parte === 2 ? "2ª" : "1ª"} quinzena` : ""}</span>
                        {/* Doc 22: a linha do pagamento mostra só o vencimento — NÃO as datas das sessões
                            (o detalhe por data saiu; a quinzena exibe apenas a data de vencimento). */}
                        <span className="block text-[11px] text-foreground/50">{l.sessoes} {l.sessoes === 1 ? "sessão" : "sessões"}<VencimentoEditavel patientId={patientId} c={l} /></span>
                        {/* Doc 22: diferença de um pacote anterior que foi somada a este. */}
                        {l.arrastoRecebido > 0 && (
                          <span className="block text-[11px] text-[#92400e]/80">inclui {formatBRL(l.arrastoRecebido)} de diferença do pacote anterior ({formatBRL(l.valorBase)} + {formatBRL(l.arrastoRecebido)})</span>
                        )}
                        {/* Doc 22: pacote encerrado cuja diferença rolou para a próxima cobrança.
                            Doc 33: mostra também a conta — (valor da cobrança − valor transferido). */}
                        {l.transferido > 0 && (
                          <span className="block text-[11px] text-[#92400e]/80">{formatBRL(l.transferido)} transferido para a próxima cobrança do pacote ({formatBRL(l.valor)} − {formatBRL(l.transferido)})</span>
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
                    {aberta === l.chave && <Lancamento patientId={patientId} c={l} responsavel={responsavel} responsavelCpf={responsavelCpf ?? ""} fechar={() => setAberta(null)} creditoDisponivel={creditoDisponivel} creditoAConfirmar={creditoAConfirmar} />}
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
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{b.dia} {b.data} {b.hora}</td>
                    <td className="px-3 py-2 text-foreground/30 text-center">—</td>
                    <td className="px-3 py-2">
                      <span className="block w-full text-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#fee2e2] text-[#991b1b]">Hor. Bloq.</span>
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
                  {/* `data-chave` (doc 64): a cobrança embutida na sessão — é por ela que o
                      "Gerenciar" da Carteira encontra a linha e a destaca. */}
                  <tr className="border-t border-border" data-sessao={l.id} data-chave={c?.chave}>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {p.dia} {p.data} {p.hora}
                        {l.online ? <Video className="w-3.5 h-3.5 text-primary" aria-label="online" /> : <MapPin className="w-3.5 h-3.5 text-foreground/30" aria-label="presencial" />}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums text-center">{l.rotulo || "—"}</td>
                    <CelulaStatus status={l.status} />
                    {/* Doc 30: o valor da sessão AVULSA (formato "sessao") sai em negrito na tabela de Controle. */}
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${c?.formato === "sessao" ? "font-bold" : ""}`}>
                      {l.valor == null ? "" : formatBRL(l.valor)}
                      {/* Doc 62: o lápis só onde a sessão tem valor PRÓPRIO — "a cada sessão" e
                          avulsa. O servidor recusa o resto pela mesma regra; aqui só não ofertamos. */}
                      {c && (c.chave === `sessao:${l.id}` || c.chave === `extra:${l.id}`) && (
                        <ValorEditavel patientId={patientId} sessionId={l.id} valor={l.valor ?? 0} />
                      )}
                    </td>
                    {c ? (
                      <ColunasDoPagamento patientId={patientId} c={c} onLancar={() => setAberta(c.chave)} cobrar={cobrar} aviso={l.avisoDaCobranca} />
                    ) : l.avisoDoPagamento ? (
                      /* Doc 55: a sessão deixou de ser cobrada. Linha que esvazia sem explicação,
                         numa tabela de dinheiro, vira dúvida — e a mais cara é "para onde foi o que
                         o paciente pagou?". */
                      <td className="px-3 py-2 text-xs text-foreground/50">{l.avisoDoPagamento}</td>
                    ) : (
                      <td />
                    )}
                  </tr>
                  {c && aberta === c.chave && <Lancamento patientId={patientId} c={c} responsavel={responsavel} responsavelCpf={responsavelCpf ?? ""} fechar={() => setAberta(null)} creditoDisponivel={creditoDisponivel} creditoAConfirmar={creditoAConfirmar} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
