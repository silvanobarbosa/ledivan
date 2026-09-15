import { db } from "@/db";
import { auth } from "@/auth";
import { blockedSlots, patientPackages, patientPaymentFormatHistory, patients, sessionPayments, therapySessions, users } from "@/db/schema";
import { and, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { AgendaClient } from "./AgendaClient";
import { riskFromSessions } from "@/lib/therapy";
import { parseLocations } from "@/lib/locations";
import { parseHolidayCities, holidaysByDate } from "@/lib/holidays";
import { derivePackageLabels } from "@/lib/packages";
import { tamanhosDasSequencias } from "@/lib/sequenciaPacote";
import { rotulosDasSessoes } from "@/lib/cobrancas";
import { horaDeParede, horaDeParedeOuNulo } from "@/lib/horaLocal";
import { pagamentoAtrasado } from "@/lib/pagamentoSessao";

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Janela de exibição: últimos 120 dias (para cálculo de risco/histórico recente) em diante.
  const windowStart = new Date(); windowStart.setDate(windowStart.getDate() - 120);

  const [list, pats, bloqueios, me] = await Promise.all([
    db.query.therapySessions.findMany({
      where: and(eq(therapySessions.userId, session.user.id), gte(therapySessions.date, windowStart)),
      columns: { id: true, patientId: true, date: true, duration: true, status: true, isOnline: true, meetingUrl: true, meetingOpenedAt: true, guestJoinedAt: true, meetingEndedAt: true, pendingConfirmation: true, patientConfirmedAt: true, rescheduleRequestedAt: true, patientArrivedAt: true, location: true, recurring: true, recurrenceFreq: true, sessionKind: true, packageId: true, abaterDoPacote: true },
      with: { patient: { columns: { name: true } } },
    }),
    db.query.patients.findMany({
      where: and(eq(patients.userId, session.user.id), ne(patients.patientStatus, "inativo")),
      columns: { id: true, name: true, patientStatus: true, attendanceMode: true, attendanceLocation: true, birthDate: true, paymentFormat: true, pacoteTipo: true, horasAntesPagamento: true, agendaId: true, registrationNumber: true, atendimentoSocial: true, frequency: true, sessionFee: true },
      orderBy: [patients.name],
    }),
    // Os horários tirados do ar que não são paciente: supervisão, curso, médico. Vêm de tabela
    // própria justamente para não terem como vazar para contagem de pacote nem para o fechamento.
    db.select({ id: blockedSlots.id, date: blockedSlots.date, duration: blockedSlots.duration, note: blockedSlots.note })
      .from(blockedSlots)
      .where(and(eq(blockedSlots.userId, session.user.id), gte(blockedSlots.date, windowStart))),
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
  ]);

  // Numeração 1/N do pacote (derivada por data) — sobre TODAS as sessões do pacote, não só a janela.
  const [pkgSessions, pkgs] = await Promise.all([
    db.select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status, packageId: therapySessions.packageId })
      .from(therapySessions).where(and(eq(therapySessions.userId, session.user.id), isNotNull(therapySessions.packageId))),
    db.select({ id: patientPackages.id, seq: patientPackages.seq, sessions: patientPackages.sessions })
      .from(patientPackages).where(eq(patientPackages.userId, session.user.id)),
  ]);
  const pkgLabels = derivePackageLabels(
    pkgSessions.map((s) => ({ id: s.id, date: s.date, status: s.status, packageId: s.packageId })),
    pkgs,
  );

  // O RÓTULO DA CÉLULA (1/4, AVUL, GRAT, DEVOL) sai do MOTOR ÚNICO de cobranças, pelo formato que
  // valia no DIA de cada sessão.
  //
  // Antes a agenda usava o formato de HOJE para a história inteira: trocar um paciente de gratuito
  // para mensal reescrevia as células antigas junto, igual acontecia com a cobrança. E a varredura
  // é do histórico INTEIRO, de propósito — a sequência atravessa a virada do mês, e começar no meio
  // faria a primeira sessão da janela aparecer como 1/4 quando ela é 3/4.
  const codigos = new Map<string, string>();
  const vigenciasPorPaciente = new Map<string, { formato: string; pacoteTipo: string | null; desde: string; criadoEm: string }[]>();
  if (pats.length) {
    const ids = pats.map((x) => x.id);
    const [todas, contratos, vigencias] = await Promise.all([
      db.select({ id: therapySessions.id, patientId: therapySessions.patientId, date: therapySessions.date, status: therapySessions.status, sessionKind: therapySessions.sessionKind, abaterDoPacote: therapySessions.abaterDoPacote, chargeable: therapySessions.chargeable, extra: therapySessions.extra })
        .from(therapySessions)
        .where(and(eq(therapySessions.userId, session.user.id), inArray(therapySessions.patientId, ids))),
      db.select({ patientId: patientPackages.patientId, seq: patientPackages.seq, sessions: patientPackages.sessions })
        .from(patientPackages)
        .where(and(eq(patientPackages.userId, session.user.id), inArray(patientPackages.patientId, ids))),
      db.select({ patientId: patientPaymentFormatHistory.patientId, formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo, desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
        .from(patientPaymentFormatHistory)
        .where(inArray(patientPaymentFormatHistory.patientId, ids)),
    ]);
    for (const paciente of pats) {
      const rotulos = rotulosDasSessoes({
        vigencias: vigencias.filter((v) => v.patientId === paciente.id),
        reserva: { formato: paciente.paymentFormat, pacoteTipo: paciente.pacoteTipo },
        sessoes: todas.filter((x) => x.patientId === paciente.id).map((x) => ({ ...x, date: x.date as Date })),
        precos: [],
        tamanhos: tamanhosDasSequencias(contratos.filter((c) => c.patientId === paciente.id)),
      });
      for (const [id, codigo] of rotulos) codigos.set(id, codigo);
      vigenciasPorPaciente.set(
        paciente.id,
        vigencias.filter((v) => v.patientId === paciente.id).map((v) => ({ formato: v.formato, pacoteTipo: v.pacoteTipo, desde: horaDeParede(v.desde), criadoEm: horaDeParede(v.criadoEm) })),
      );
    }
  }

  // Pagamento atrasado: só marca, não faz. Quem paga a cada sessão tem um prazo ("pagar até X
  // horas antes"); passado o prazo sem pagamento, a agenda avisa o profissional — que decide
  // atender assim mesmo ou cancelar a sessão. O sistema não cancela nada sozinho.
  const agora = new Date();
  const porSessao = new Map(pats.filter((x) => x.paymentFormat === "sessao" && x.horasAntesPagamento).map((x) => [x.id, x.horasAntesPagamento as number]));
  const atrasadas = new Set<string>();
  if (porSessao.size) {
    const pagos = await db.select({ sessionId: sessionPayments.sessionId })
      .from(sessionPayments)
      .where(and(eq(sessionPayments.userId, session.user.id), eq(sessionPayments.status, "paid")));
    const pagas = new Set(pagos.map((x) => x.sessionId).filter(Boolean) as string[]);
    for (const s of list) {
      const horas = porSessao.get(s.patientId);
      if (!horas) continue;
      if (pagamentoAtrasado({ agora, dataSessao: s.date as Date, horasAntes: horas, pago: pagas.has(s.id), status: s.status })) {
        atrasadas.add(s.id);
      }
    }
  }

  const locations = parseLocations(me?.attendanceLocations);

  // Feriados: cidades escolhidas pelo usuário (até 3). Busca anos relevantes (janela + ano atual + próximo).
  const holidayCities = parseHolidayCities(me?.holidayCities);
  const now = new Date();
  const years = Array.from(new Set([windowStart.getFullYear(), now.getFullYear(), now.getFullYear() + 1]));
  const holidayMap = await holidaysByDate(holidayCities, years);
  const holidays = Object.fromEntries(holidayMap);

  // risco de falta por paciente (calculado sobre o histórico completo)
  const byPatient = new Map<string, { status: string; date: Date }[]>();
  for (const s of list) {
    const arr = byPatient.get(s.patientId) ?? [];
    arr.push({ status: s.status, date: s.date as Date });
    byPatient.set(s.patientId, arr);
  }
  const riskByPatient = new Map<string, string>();
  for (const [pid, sess] of byPatient) riskByPatient.set(pid, riskFromSessions(sess).level);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Agenda</h1>
        <p className="text-foreground/50 mt-1">Sessões da semana</p>
      </div>
      <AgendaClient
        sessions={list.map((s) => ({
          id: s.id,
          date: horaDeParede(s.date),
          duration: s.duration,
          status: s.status,
          isOnline: s.isOnline,
          meetingUrl: s.meetingUrl,
          patientName: s.patient?.name ?? "—",
          risk: riskByPatient.get(s.patientId) ?? "baixo",
          meetingOpenedAt: horaDeParedeOuNulo(s.meetingOpenedAt),
          guestJoinedAt: horaDeParedeOuNulo(s.guestJoinedAt),
          meetingEndedAt: horaDeParedeOuNulo(s.meetingEndedAt),
          pendingConfirmation: s.pendingConfirmation,
          patientConfirmed: !!s.patientConfirmedAt,
          rescheduleRequested: !!s.rescheduleRequestedAt,
          patientArrived: !!s.patientArrivedAt,
          location: s.location,
          recurring: s.recurring,
          recurrenceFreq: s.recurrenceFreq ?? null,
          patientId: s.patientId,
          sessionKind: s.sessionKind ?? "consulta",
          abaterDoPacote: s.abaterDoPacote,
          pkg: pkgLabels.get(s.id) ?? null,
          codigo: codigos.get(s.id) ?? null,
          pagamentoAtrasado: atrasadas.has(s.id),
        }))}
        patients={pats.map((p) => ({ id: p.id, name: p.name, status: p.patientStatus, attendanceMode: p.attendanceMode, attendanceLocation: p.attendanceLocation, atendimentoSocial: p.atendimentoSocial, frequency: p.frequency, agendaId: p.agendaId, registrationNumber: p.registrationNumber, paymentFormat: p.paymentFormat, pacoteTipo: p.pacoteTipo, sessionFee: p.sessionFee, vigencias: vigenciasPorPaciente.get(p.id) ?? [] }))}
        birthdays={pats.filter((p) => p.birthDate).map((p) => { const b = new Date(p.birthDate as unknown as string); return { name: p.name, month: b.getMonth() + 1, day: b.getDate() }; })}
        locations={locations}
        holidays={holidays}
        blocks={bloqueios.map((b) => ({ id: b.id, date: horaDeParede(b.date), duration: b.duration, note: b.note }))}
        holidayCities={holidayCities}
      />
    </div>
  );
}
