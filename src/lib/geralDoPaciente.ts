import "server-only";

/**
 * Carrega os fatos de UM paciente e devolve as linhas da guia Geral prontas para a tela.
 *
 * Mora fora da página porque a ação de lançar pagamento precisa da MESMA conta para saber quanto
 * falta numa cobrança — o valor gravado nunca vem do formulário.
 *
 * Datas: toda coluna aqui é `timestamp` sem fuso (hora de parede — ver `horaLocal.ts`). Entram no
 * motor já convertidas para hora LOCAL do processo, e saem como texto sem fuso. Assim a conta e a
 * tela dão o mesmo resultado na Vercel (UTC) e na máquina de quem desenvolve (UTC−3).
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { blockedSlots, cobrancaEnvios, cobrancaVencimentos, sessoesPuladas, patientCredits, patientPackages, patientPackageHistory, patientPaymentFormatHistory, patientPriceHistory, patients, sessionPayments, therapySessions } from "@/db/schema";
import { horaDeParede } from "./horaLocal";
import { linhasDaGeral, resumoDaGeral, type CobrancaDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "./guiaGeral";
import { tamanhosDasSequencias } from "./sequenciaPacote";

const local = (d: Date | string | null | undefined): Date => new Date(horaDeParede(d));
const dois = (n: number) => String(n).padStart(2, "0");
const texto = (d: Date | null | undefined): string | null =>
  d ? `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:00` : null;

/** Hoje no relógio de quem atende (o servidor da Vercel está em UTC: às 22h daqui já é amanhã lá). */
export function hojeDeParede(agora = new Date()): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
}

export type CobrancaNaTela = Omit<CobrancaDaGeral, "vencimento" | "competencia" | "pagamento" | "pagamentos" | "envio" | "posicao" | "tipo"> & {
  tipoDeCobranca: CobrancaDaGeral["tipo"];
  vencimento: string | null;
  /** Doc 31: o vencimento desta cobrança foi EDITADO à mão (há override). A tela mostra o "desfazer". */
  vencimentoEditado: boolean;
  pagamento: { id: string; data: string; metodo: string | null; pagoPor: string | null; recibo: boolean; nota: boolean; credito: boolean } | null;
  /** Cada lançamento desta cobrança (doc 21/28): id (remover), data (hora de parede), valor, quem
   *  pagou, método e se já teve recibo/nota emitidos (p/ os controles por lançamento). */
  pagamentos: { id: string; data: string; valor: number; pagoPor: string | null; metodo: string | null; recibo: boolean; nota: boolean; credito: boolean }[];
  /**
   * Os avisos daquela cobranca (`data` = hora de parede). `total` e `datas` trazem o historico
   * inteiro: cada clique em "Cobrar" e um aviso, e o documento de 17/09 pede que nenhum substitua
   * o anterior.
   */
  envio: { data: string; por: string | null; total: number; datas: string[] } | null;
};

export type LinhaNaTela =
  | { tipo: "sessao"; id: string; data: string; online: boolean; status: string; rotulo: string; valor: number | null; cobranca: CobrancaNaTela | null }
  | ({ tipo: "pagamento" } & CobrancaNaTela)
  /** Data que a serie pulou por horario bloqueado. Nao e sessao: so ocupa a linha (dona, 19/09). */
  | { tipo: "bloqueio"; data: string };

function cobrancaNaTela(
  c: Omit<CobrancaDaGeral, "tipo"> & { tipoDeCobranca: CobrancaDaGeral["tipo"] },
  editados: Set<string>,
): CobrancaNaTela {
  return {
    chave: c.chave,
    tipoDeCobranca: c.tipoDeCobranca,
    formato: c.formato,
    valor: c.valor,
    falta: c.falta,
    valorDevido: c.valorDevido,
    valorBase: c.valorBase,
    arrastoRecebido: c.arrastoRecebido,
    transferido: c.transferido,
    valorPago: c.valorPago,
    sessoes: c.sessoes,
    vencimentoEditado: editados.has(c.chave),
    // Ids das sessões desta cobrança (doc 29): é o conjunto CERTO para o recibo — já exclui gratuita,
    // Desmarcou/Prof.desm/Atestado e inclui Presente/Faltou. O recibo escopa por aqui, não por todas
    // as sessões do paciente (bug do doc 28: cruzava a fronteira da cobrança e trazia data errada).
    ids: c.ids,
    parte: c.parte,
    situacao: c.situacao,
    vencimento: texto(c.vencimento ?? c.competencia),
    pagamento: c.pagamento ? { ...c.pagamento, data: texto(c.pagamento.data) ?? "", credito: c.pagamento.credito === true } : null,
    pagamentos: c.pagamentos.map((p) => ({ id: p.id, data: texto(p.data) ?? "", valor: p.valor, pagoPor: p.pagoPor, metodo: p.metodo, recibo: p.recibo === true, nota: p.nota === true, credito: p.credito === true })),
    envio: c.envio
      ? { data: texto(c.envio.data) ?? "", por: c.envio.por, total: c.envio.total, datas: c.envio.datas.map((d) => texto(d) ?? "") }
      : null,
  };
}

function naTela(l: LinhaDaGeral, editados: Set<string>): LinhaNaTela {
  if (l.tipo === "pagamento") return { tipo: "pagamento", ...cobrancaNaTela(l, editados) };
  if (l.tipo === "bloqueio") return { tipo: "bloqueio", data: texto(l.data) ?? "" };
  return {
    tipo: "sessao",
    id: l.id,
    data: texto(l.data) ?? "",
    online: l.online,
    status: l.status,
    rotulo: l.rotulo,
    valor: l.valor,
    cobranca: l.cobranca ? cobrancaNaTela({ ...l.cobranca, tipoDeCobranca: l.cobranca.tipo }, editados) : null,
  };
}

export type ResumoNaTela = {
  saldo: number;
  totalPago: number;
  totalExigivel: number;
  emAberto: number;
  emAtraso: number;
  nAberto: number;
  nAtraso: number;
  sessoesEmAberto: number;
  sessoesEmAtraso: number;
  extrato: { id: string; data: string; tipo: "pagamento" | "cobranca"; descricao: string; valor: number; saldo: number; pagamentoId: string | null }[];
};

/** `null` = paciente não existe ou não é deste profissional. */
export async function geralDoPaciente(userId: string, patientId: string): Promise<{ linhas: LinhaNaTela[]; resumo: ResumoNaTela } | null> {
  const paciente = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
    columns: { id: true, paymentFormat: true, pacoteTipo: true, sessionFee: true, paymentDay: true, paymentDay2: true, horasAntesPagamento: true, timesPerPeriod: true, sessionsInPacket: true },
  });
  if (!paciente) return null;

  const [sessoes, pagamentos, precos, pacotes, vigencias, envios, puladas, pacoteHist, vencEditados] = await Promise.all([
    db.select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status, sessionKind: therapySessions.sessionKind, abaterDoPacote: therapySessions.abaterDoPacote, chargeable: therapySessions.chargeable, extra: therapySessions.extra, valorExtra: therapySessions.valorExtra, repoeSessaoId: therapySessions.repoeSessaoId, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(and(eq(therapySessions.patientId, patientId), eq(therapySessions.userId, userId))),
    db.select({ id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date, status: sessionPayments.status, method: sessionPayments.method, pagoPor: sessionPayments.pagoPor, cobrancaChave: sessionPayments.cobrancaChave, quita: sessionPayments.quitaDiferenca, kind: sessionPayments.kind, reciboEmitidoEm: sessionPayments.reciboEmitidoEm, notaEmitidaEm: sessionPayments.receiptIssuedAt })
      .from(sessionPayments).where(and(eq(sessionPayments.patientId, patientId), eq(sessionPayments.userId, userId))),
    db.select({ valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
      .from(patientPriceHistory).where(eq(patientPriceHistory.patientId, patientId)),
    db.select({ seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(and(eq(patientPackages.patientId, patientId), eq(patientPackages.userId, userId))),
    db.select({ formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory).where(eq(patientPaymentFormatHistory.patientId, patientId)),
    db.select({ cobrancaChave: cobrancaEnvios.cobrancaChave, enviadaEm: cobrancaEnvios.enviadaEm, enviadaPor: cobrancaEnvios.enviadaPor })
      .from(cobrancaEnvios).where(and(eq(cobrancaEnvios.patientId, patientId), eq(cobrancaEnvios.userId, userId))),
    /**
     * So as faltas cujo horario AINDA esta bloqueado.
     *
     * Desbloqueou, a linha "Hor. Bloq." some sozinha — e o que a dona pede (19/09: "o registro
     * devera ser removido"). O registro em si fica, porque e ele que sabe para onde devolver a
     * sequencia se ela mandar remanejar; quem some e a linha.
     */
    db.select({ date: sessoesPuladas.date })
      .from(sessoesPuladas)
      .innerJoin(blockedSlots, and(eq(blockedSlots.userId, sessoesPuladas.userId), eq(blockedSlots.date, sessoesPuladas.date)))
      .where(and(eq(sessoesPuladas.patientId, patientId), eq(sessoesPuladas.userId, userId))),
    // Doc 30: vigências do tamanho do pacote.
    db.select({ tamanho: patientPackageHistory.tamanho, desde: patientPackageHistory.dataEfetiva })
      .from(patientPackageHistory).where(eq(patientPackageHistory.patientId, patientId)),
    // Doc 31: vencimentos editados à mão (override por chave de cobrança).
    db.select({ cobrancaChave: cobrancaVencimentos.cobrancaChave, vencimento: cobrancaVencimentos.vencimento })
      .from(cobrancaVencimentos).where(and(eq(cobrancaVencimentos.patientId, patientId), eq(cobrancaVencimentos.userId, userId))),
  ]);

  const editados = new Set(vencEditados.map((v) => v.cobrancaChave));

  const entrada: EntradaDaGeral = {
    vigencias: vigencias.map((v) => ({ ...v, desde: local(v.desde), criadoEm: local(v.criadoEm) })),
    reserva: { formato: paciente.paymentFormat, pacoteTipo: paciente.pacoteTipo },
    sessoes: sessoes.map((s) => ({ ...s, date: local(s.date), online: s.isOnline })),
    precos: precos.map((p) => ({ valor: Number(p.valor) || 0, desde: local(p.dataEfetiva) })),
    valorDaSessao: Number(paciente.sessionFee) || 0,
    tamanhos: tamanhosDasSequencias(pacotes),
    tamanhoPacote: paciente.sessionsInPacket,
    tamanhosPorData: pacoteHist.map((h) => ({ desde: local(h.desde), tamanho: h.tamanho })),
    vezesPorSemana: paciente.timesPerPeriod,
    diaPagamento: paciente.paymentDay,
    diaPagamento2: paciente.paymentDay2,
    horasAntesPagamento: paciente.horasAntesPagamento,
    pagamentos: pagamentos.map((p) => ({ id: p.id, valor: p.amount, data: local(p.date), status: p.status, metodo: p.method, pagoPor: p.pagoPor, cobrancaChave: p.cobrancaChave, quita: p.quita, kind: p.kind, recibo: !!p.reciboEmitidoEm, nota: !!p.notaEmitidaEm })),
    envios: envios.map((e) => ({ cobrancaChave: e.cobrancaChave, enviadaEm: local(e.enviadaEm), enviadaPor: e.enviadaPor })),
    vencimentos: vencEditados.map((v) => ({ chave: v.cobrancaChave, vencimento: local(v.vencimento) })),
    // As datas que a serie pulou por horario bloqueado: viram a linha "Hor. Bloq.", nunca sessao.
    bloqueios: puladas.map((b) => ({ data: local(b.date) })),
    hoje: hojeDeParede(),
  };
  const resumo = resumoDaGeral(entrada);
  return {
    linhas: linhasDaGeral(entrada).map((l) => naTela(l, editados)),
    resumo: { ...resumo, extrato: resumo.extrato.map((m) => ({ ...m, data: texto(m.data) ?? "" })) },
  };
}

/** Soma dos créditos ainda não consumidos de um paciente (o "saldo" do doc 36). */
export async function creditoDisponivel(userId: string, patientId: string): Promise<number> {
  const rows = await db.select({ valor: patientCredits.valor }).from(patientCredits)
    .where(and(eq(patientCredits.userId, userId), eq(patientCredits.patientId, patientId), isNull(patientCredits.consumidoEm)));
  return Math.round(rows.reduce((s, r) => s + (Number(r.valor) || 0), 0) * 100) / 100;
}
