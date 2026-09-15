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
import { patientPackages, patientPaymentFormatHistory, patientPriceHistory, patients, sessionPayments, therapySessions } from "@/db/schema";
import { horaDeParede } from "./horaLocal";
import { linhasDaGeral, type CobrancaDaGeral, type LinhaDaGeral } from "./guiaGeral";
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

export type CobrancaNaTela = Omit<CobrancaDaGeral, "vencimento" | "competencia" | "pagamento" | "ids" | "posicao" | "tipo"> & {
  tipoDeCobranca: CobrancaDaGeral["tipo"];
  vencimento: string | null;
  pagamento: { id: string; data: string; metodo: string | null; pagoPor: string | null } | null;
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

/** `null` = paciente não existe ou não é deste profissional. */
export async function geralDoPaciente(userId: string, patientId: string): Promise<LinhaNaTela[] | null> {
  const paciente = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
    columns: { id: true, paymentFormat: true, pacoteTipo: true, sessionFee: true, paymentDay: true, paymentDay2: true },
  });
  if (!paciente) return null;

  const [sessoes, pagamentos, precos, pacotes, vigencias] = await Promise.all([
    db.select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status, sessionKind: therapySessions.sessionKind, abaterDoPacote: therapySessions.abaterDoPacote, extra: therapySessions.extra, valorExtra: therapySessions.valorExtra, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(and(eq(therapySessions.patientId, patientId), eq(therapySessions.userId, userId))),
    db.select({ id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date, status: sessionPayments.status, method: sessionPayments.method, pagoPor: sessionPayments.pagoPor, cobrancaChave: sessionPayments.cobrancaChave })
      .from(sessionPayments).where(and(eq(sessionPayments.patientId, patientId), eq(sessionPayments.userId, userId))),
    db.select({ valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
      .from(patientPriceHistory).where(eq(patientPriceHistory.patientId, patientId)),
    db.select({ seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(and(eq(patientPackages.patientId, patientId), eq(patientPackages.userId, userId))),
    db.select({ formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory).where(eq(patientPaymentFormatHistory.patientId, patientId)),
  ]);

  const linhas = linhasDaGeral({
    vigencias: vigencias.map((v) => ({ ...v, desde: local(v.desde), criadoEm: local(v.criadoEm) })),
    reserva: { formato: paciente.paymentFormat, pacoteTipo: paciente.pacoteTipo },
    sessoes: sessoes.map((s) => ({ ...s, date: local(s.date), online: s.isOnline })),
    precos: precos.map((p) => ({ valor: Number(p.valor) || 0, desde: local(p.dataEfetiva) })),
    valorDaSessao: Number(paciente.sessionFee) || 0,
    tamanhos: tamanhosDasSequencias(pacotes),
    diaPagamento: paciente.paymentDay,
    diaPagamento2: paciente.paymentDay2,
    pagamentos: pagamentos.map((p) => ({ id: p.id, valor: p.amount, data: local(p.date), status: p.status, metodo: p.method, pagoPor: p.pagoPor, cobrancaChave: p.cobrancaChave })),
    hoje: hojeDeParede(),
  });
  return linhas.map(naTela);
}
