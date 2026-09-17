import "server-only";

/**
 * A situação de pagamento (em dia / em aberto / atrasado) de VÁRIOS pacientes de uma vez, para a
 * lista de pacientes (dono, 16/09/2026).
 *
 * A conta é a mesma do paciente individual (`resumoDaGeral`, o motor único), mas os fatos são
 * carregados em LOTE — uma consulta por tabela, não uma por paciente — e agrupados na memória. Assim
 * a lista abre com uma leva de queries fixa, e não uma por linha. O motor continua sendo a única
 * fonte da verdade sobre quem deve e quanto.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { patientPackages, patientPaymentFormatHistory, patientPriceHistory, sessionPayments, therapySessions } from "@/db/schema";
import { horaDeParede } from "./horaLocal";
import { resumoDaGeral, type EntradaDaGeral } from "./guiaGeral";
import { hojeDeParede } from "./geralDoPaciente";
import { tamanhosDasSequencias } from "./sequenciaPacote";
import { situacaoDaLista, type SituacaoDaLista } from "./rotulosPaciente";

const local = (d: Date | string | null | undefined): Date => new Date(horaDeParede(d));

export type PacienteParaSituacao = {
  id: string;
  paymentFormat: string | null;
  pacoteTipo: string | null;
  sessionFee: string | null;
  paymentDay: number | null;
  paymentDay2: number | null;
  horasAntesPagamento: number | null;
};

export type SituacaoResumo = { situacao: SituacaoDaLista; nAberto: number; nAtraso: number };

/** Agrupa uma lista por uma chave, na ordem de chegada. */
function agrupar<T>(linhas: T[], chave: (l: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of linhas) {
    const k = chave(l);
    (m.get(k) ?? m.set(k, []).get(k)!).push(l);
  }
  return m;
}

export async function situacoesDaLista(userId: string, pacientes: PacienteParaSituacao[]): Promise<Map<string, SituacaoResumo>> {
  const ids = pacientes.map((p) => p.id);
  const saida = new Map<string, SituacaoResumo>();
  if (!ids.length) return saida;

  const [sessoes, pagamentos, precos, vigencias, pacotes] = await Promise.all([
    db.select({ id: therapySessions.id, patientId: therapySessions.patientId, date: therapySessions.date, status: therapySessions.status, sessionKind: therapySessions.sessionKind, abaterDoPacote: therapySessions.abaterDoPacote, chargeable: therapySessions.chargeable, extra: therapySessions.extra, valorExtra: therapySessions.valorExtra, repoeSessaoId: therapySessions.repoeSessaoId, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(eq(therapySessions.userId, userId)),
    db.select({ id: sessionPayments.id, patientId: sessionPayments.patientId, amount: sessionPayments.amount, date: sessionPayments.date, status: sessionPayments.status, method: sessionPayments.method, pagoPor: sessionPayments.pagoPor, cobrancaChave: sessionPayments.cobrancaChave, kind: sessionPayments.kind })
      .from(sessionPayments).where(eq(sessionPayments.userId, userId)),
    db.select({ patientId: patientPriceHistory.patientId, valor: patientPriceHistory.valor, dataEfetiva: patientPriceHistory.dataEfetiva })
      .from(patientPriceHistory).where(inArray(patientPriceHistory.patientId, ids)),
    db.select({ patientId: patientPaymentFormatHistory.patientId, formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory).where(inArray(patientPaymentFormatHistory.patientId, ids)),
    db.select({ patientId: patientPackages.patientId, seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(and(eq(patientPackages.userId, userId), inArray(patientPackages.patientId, ids))),
  ]);

  const porPaciente = {
    sessoes: agrupar(sessoes, (s) => s.patientId),
    pagamentos: agrupar(pagamentos, (p) => p.patientId),
    precos: agrupar(precos, (p) => p.patientId),
    vigencias: agrupar(vigencias, (v) => v.patientId),
    pacotes: agrupar(pacotes, (p) => p.patientId),
  };
  const hoje = hojeDeParede();

  for (const p of pacientes) {
    const entrada: EntradaDaGeral = {
      vigencias: (porPaciente.vigencias.get(p.id) ?? []).map((v) => ({ formato: v.formato, pacoteTipo: v.pacoteTipo, desde: local(v.desde), criadoEm: local(v.criadoEm) })),
      reserva: { formato: p.paymentFormat, pacoteTipo: p.pacoteTipo },
      sessoes: (porPaciente.sessoes.get(p.id) ?? []).map((s) => ({ id: s.id, date: local(s.date), status: s.status, sessionKind: s.sessionKind, abaterDoPacote: s.abaterDoPacote, chargeable: s.chargeable, extra: s.extra, valorExtra: s.valorExtra, repoeSessaoId: s.repoeSessaoId, online: s.isOnline })),
      precos: (porPaciente.precos.get(p.id) ?? []).map((x) => ({ valor: Number(x.valor) || 0, desde: local(x.dataEfetiva) })),
      valorDaSessao: Number(p.sessionFee) || 0,
      tamanhos: tamanhosDasSequencias(porPaciente.pacotes.get(p.id) ?? []),
      diaPagamento: p.paymentDay,
      diaPagamento2: p.paymentDay2,
      horasAntesPagamento: p.horasAntesPagamento,
      pagamentos: (porPaciente.pagamentos.get(p.id) ?? []).map((x) => ({ id: x.id, valor: x.amount, data: local(x.date), status: x.status, metodo: x.method, pagoPor: x.pagoPor, cobrancaChave: x.cobrancaChave, kind: x.kind })),
      hoje,
    };
    const r = resumoDaGeral(entrada);
    saida.set(p.id, { situacao: situacaoDaLista(r.nAberto, r.nAtraso), nAberto: r.nAberto, nAtraso: r.nAtraso });
  }

  return saida;
}
