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
import { COLUNAS_DA_SESSAO_COM_PACIENTE } from "@/lib/colunasDaSessao";
import { COLUNAS_DO_PAGAMENTO, COLUNAS_DO_PRECO, local, pagamentoParaMotor, precoParaMotor, sessaoParaMotor } from "@/lib/entradaDoMotor";
import { cobrancaVencimentos, patientPackages, patientPackageHistory, patientPaymentFormatHistory, patientPriceHistory, sessionPayments, therapySessions } from "@/db/schema";
import { resumoDaGeral, type EntradaDaGeral } from "./guiaGeral";
import { hojeDeParede } from "./geralDoPaciente";
import { tamanhosDasSequencias } from "./sequenciaPacote";
import { situacaoDaLista, type SituacaoDaLista } from "./rotulosPaciente";


export type PacienteParaSituacao = {
  id: string;
  paymentFormat: string | null;
  pacoteTipo: string | null;
  sessionFee: string | null;
  paymentDay: number | null;
  paymentDay2: number | null;
  timesPerPeriod: number | null;
  horasAntesPagamento: number | null;
  sessionsInPacket: number | null;
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

  const [sessoes, pagamentos, precos, vigencias, pacotes, pacoteHist, vencEditados] = await Promise.all([
    db.select({ ...COLUNAS_DA_SESSAO_COM_PACIENTE, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(eq(therapySessions.userId, userId)),
    db.select({ ...COLUNAS_DO_PAGAMENTO, patientId: sessionPayments.patientId })
      .from(sessionPayments).where(eq(sessionPayments.userId, userId)),
    db.select({ patientId: patientPriceHistory.patientId, ...COLUNAS_DO_PRECO })
      .from(patientPriceHistory).where(inArray(patientPriceHistory.patientId, ids)),
    db.select({ patientId: patientPaymentFormatHistory.patientId, formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory).where(inArray(patientPaymentFormatHistory.patientId, ids)),
    db.select({ patientId: patientPackages.patientId, seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(and(eq(patientPackages.userId, userId), inArray(patientPackages.patientId, ids))),
    // Doc 30: vigências do tamanho do pacote. Doc 33 (F17): a lista PRECISA destes fatos, senão a
    // situação de atraso diverge da tela do paciente (motor único, fontes diferentes = conta diferente).
    db.select({ patientId: patientPackageHistory.patientId, tamanho: patientPackageHistory.tamanho, desde: patientPackageHistory.dataEfetiva })
      .from(patientPackageHistory).where(inArray(patientPackageHistory.patientId, ids)),
    // Doc 31 (E): vencimentos editados à mão — sem isto a lista usa a data calculada e marca "atraso"
    // onde o dono já empurrou o vencimento para a frente.
    db.select({ patientId: cobrancaVencimentos.patientId, cobrancaChave: cobrancaVencimentos.cobrancaChave, vencimento: cobrancaVencimentos.vencimento })
      .from(cobrancaVencimentos).where(and(eq(cobrancaVencimentos.userId, userId), inArray(cobrancaVencimentos.patientId, ids))),
  ]);

  const porPaciente = {
    sessoes: agrupar(sessoes, (s) => s.patientId),
    pagamentos: agrupar(pagamentos, (p) => p.patientId),
    precos: agrupar(precos, (p) => p.patientId),
    vigencias: agrupar(vigencias, (v) => v.patientId),
    pacotes: agrupar(pacotes, (p) => p.patientId),
    pacoteHist: agrupar(pacoteHist, (h) => h.patientId),
    vencEditados: agrupar(vencEditados, (v) => v.patientId),
  };
  const hoje = hojeDeParede();

  for (const p of pacientes) {
    const entrada: EntradaDaGeral = {
      vigencias: (porPaciente.vigencias.get(p.id) ?? []).map((v) => ({ formato: v.formato, pacoteTipo: v.pacoteTipo, desde: local(v.desde), criadoEm: local(v.criadoEm) })),
      reserva: { formato: p.paymentFormat, pacoteTipo: p.pacoteTipo },
      sessoes: (porPaciente.sessoes.get(p.id) ?? []).map(sessaoParaMotor),
      precos: (porPaciente.precos.get(p.id) ?? []).map(precoParaMotor),
      valorDaSessao: Number(p.sessionFee) || 0,
      tamanhos: tamanhosDasSequencias(porPaciente.pacotes.get(p.id) ?? []),
      tamanhoPacote: p.sessionsInPacket,
      tamanhosPorData: (porPaciente.pacoteHist.get(p.id) ?? []).map((h) => ({ desde: local(h.desde), tamanho: h.tamanho })),
      vezesPorSemana: p.timesPerPeriod ?? 1,
      diaPagamento: p.paymentDay,
      diaPagamento2: p.paymentDay2,
      horasAntesPagamento: p.horasAntesPagamento,
      pagamentos: (porPaciente.pagamentos.get(p.id) ?? []).map(pagamentoParaMotor),
      vencimentos: (porPaciente.vencEditados.get(p.id) ?? []).map((v) => ({ chave: v.cobrancaChave, vencimento: local(v.vencimento) })),
      hoje,
    };
    const r = resumoDaGeral(entrada);
    saida.set(p.id, { situacao: situacaoDaLista(r.nAberto, r.nAtraso), nAberto: r.nAberto, nAtraso: r.nAtraso });
  }

  return saida;
}
