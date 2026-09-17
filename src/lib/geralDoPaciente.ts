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

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cobrancaEnvios, patientPackages, patientPaymentFormatHistory, patientPriceHistory, patients, sessionPayments, therapySessions } from "@/db/schema";
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

export type CobrancaNaTela = Omit<CobrancaDaGeral, "vencimento" | "competencia" | "pagamento" | "envio" | "ids" | "posicao" | "tipo"> & {
  tipoDeCobranca: CobrancaDaGeral["tipo"];
  vencimento: string | null;
  pagamento: { id: string; data: string; metodo: string | null; pagoPor: string | null } | null;
  /**
   * Os avisos daquela cobranca (`data` = hora de parede). `total` e `datas` trazem o historico
   * inteiro: cada clique em "Cobrar" e um aviso, e o documento de 17/09 pede que nenhum substitua
   * o anterior.
   */
  envio: { data: string; por: string | null; total: number; datas: string[] } | null;
};

export type LinhaNaTela =
  | { tipo: "sessao"; id: string; data: string; online: boolean; status: string; rotulo: string; valor: number | null; cobranca: CobrancaNaTela | null }
  | ({ tipo: "pagamento" } & CobrancaNaTela);

function cobrancaNaTela(c: Omit<CobrancaDaGeral, "tipo"> & { tipoDeCobranca: CobrancaDaGeral["tipo"] }): CobrancaNaTela {
  return {
    chave: c.chave,
    tipoDeCobranca: c.tipoDeCobranca,
    formato: c.formato,
    valor: c.valor,
    falta: c.falta,
    sessoes: c.sessoes,
    parte: c.parte,
    situacao: c.situacao,
    vencimento: texto(c.vencimento ?? c.competencia),
    pagamento: c.pagamento ? { ...c.pagamento, data: texto(c.pagamento.data) ?? "" } : null,
    envio: c.envio
      ? { data: texto(c.envio.data) ?? "", por: c.envio.por, total: c.envio.total, datas: c.envio.datas.map((d) => texto(d) ?? "") }
      : null,
  };
}

function naTela(l: LinhaDaGeral): LinhaNaTela {
  if (l.tipo === "pagamento") return { tipo: "pagamento", ...cobrancaNaTela(l) };
  return {
    tipo: "sessao",
    id: l.id,
    data: texto(l.data) ?? "",
    online: l.online,
    status: l.status,
    rotulo: l.rotulo,
    valor: l.valor,
    cobranca: l.cobranca ? cobrancaNaTela({ ...l.cobranca, tipoDeCobranca: l.cobranca.tipo }) : null,
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
    columns: { id: true, paymentFormat: true, pacoteTipo: true, sessionFee: true, paymentDay: true, paymentDay2: true, horasAntesPagamento: true },
  });
  if (!paciente) return null;

  const [sessoes, pagamentos, precos, pacotes, vigencias, envios] = await Promise.all([
    db.select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status, sessionKind: therapySessions.sessionKind, abaterDoPacote: therapySessions.abaterDoPacote, chargeable: therapySessions.chargeable, extra: therapySessions.extra, valorExtra: therapySessions.valorExtra, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(and(eq(therapySessions.patientId, patientId), eq(therapySessions.userId, userId))),
    db.select({ id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date, status: sessionPayments.status, method: sessionPayments.method, pagoPor: sessionPayments.pagoPor, cobrancaChave: sessionPayments.cobrancaChave, kind: sessionPayments.kind })
      .from(sessionPayments).where(and(eq(sessionPayments.patientId, patientId), eq(sessionPayments.userId, userId))),
    db.select({ valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
      .from(patientPriceHistory).where(eq(patientPriceHistory.patientId, patientId)),
    db.select({ seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(and(eq(patientPackages.patientId, patientId), eq(patientPackages.userId, userId))),
    db.select({ formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory).where(eq(patientPaymentFormatHistory.patientId, patientId)),
    db.select({ cobrancaChave: cobrancaEnvios.cobrancaChave, enviadaEm: cobrancaEnvios.enviadaEm, enviadaPor: cobrancaEnvios.enviadaPor })
      .from(cobrancaEnvios).where(and(eq(cobrancaEnvios.patientId, patientId), eq(cobrancaEnvios.userId, userId))),
  ]);

  const entrada: EntradaDaGeral = {
    vigencias: vigencias.map((v) => ({ ...v, desde: local(v.desde), criadoEm: local(v.criadoEm) })),
    reserva: { formato: paciente.paymentFormat, pacoteTipo: paciente.pacoteTipo },
    sessoes: sessoes.map((s) => ({ ...s, date: local(s.date), online: s.isOnline })),
    precos: precos.map((p) => ({ valor: Number(p.valor) || 0, desde: local(p.dataEfetiva) })),
    valorDaSessao: Number(paciente.sessionFee) || 0,
    tamanhos: tamanhosDasSequencias(pacotes),
    diaPagamento: paciente.paymentDay,
    diaPagamento2: paciente.paymentDay2,
    horasAntesPagamento: paciente.horasAntesPagamento,
    pagamentos: pagamentos.map((p) => ({ id: p.id, valor: p.amount, data: local(p.date), status: p.status, metodo: p.method, pagoPor: p.pagoPor, cobrancaChave: p.cobrancaChave, kind: p.kind })),
    envios: envios.map((e) => ({ cobrancaChave: e.cobrancaChave, enviadaEm: local(e.enviadaEm), enviadaPor: e.enviadaPor })),
    hoje: hojeDeParede(),
  };
  const resumo = resumoDaGeral(entrada);
  return {
    linhas: linhasDaGeral(entrada).map(naTela),
    resumo: { ...resumo, extrato: resumo.extrato.map((m) => ({ ...m, data: texto(m.data) ?? "" })) },
  };
}
