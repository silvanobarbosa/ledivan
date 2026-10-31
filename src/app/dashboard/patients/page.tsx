import { db } from "@/db";
import { auth } from "@/auth";
import { patients, sessionPayments, therapySessions } from "@/db/schema";
import { and, eq, asc, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PatientsClient } from "./PatientsClient";
import { situacoesDaLista } from "@/lib/situacoesLista";
import { rotuloFrequenciaReal } from "@/lib/rotulosPaciente";
import { slotsRecorrentes } from "@/lib/agendaRecorrente";
import { ehSemanal2x } from "@/lib/agendamentoNovo";
import { horaDeParede } from "@/lib/horaLocal";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ status?: string; tipo?: string; dia?: string; tag?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // Saldo por paciente: pagamentos (pagos) − sessões realizadas cobráveis (em paralelo)
  const [list, paysByPatient, debitByPatient, proximas, recorrentes] = await Promise.all([
    db.query.patients.findMany({
      where: and(eq(patients.userId, userId), ne(patients.patientStatus, "prospect")),
      orderBy: [asc(patients.name)],
    }),
    db.select({ pid: sessionPayments.patientId, total: sql<string>`sum(${sessionPayments.amount})` })
      .from(sessionPayments)
      .where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid")))
      .groupBy(sessionPayments.patientId),
    db.select({ pid: therapySessions.patientId, total: sql<string>`sum(${therapySessions.fee})` })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"), eq(therapySessions.chargeable, true)))
      .groupBy(therapySessions.patientId),
    // Dia e hora de cada paciente vêm da AGENDA, não mais de um campo digitado no cadastro.
    // O dono tirou esses campos da ficha justamente porque eles viravam mentira: mudava o
    // horário na agenda e o cadastro continuava dizendo o antigo. Aqui vale a próxima sessão
    // marcada — se não há nenhuma, a lista simplesmente não mostra horário.
    db.select({ pid: therapySessions.patientId, data: sql<string>`min(${therapySessions.date})` })
      .from(therapySessions)
      .where(and(
        eq(therapySessions.userId, userId),
        sql`${therapySessions.date} >= now()`,
        ne(therapySessions.status, "cancelada"),
      ))
      .groupBy(therapySessions.patientId),
    // Frequência REAL (doc 9, #14): vem da AGENDA, igual ao dia/hora acima, não do campo do cadastro
    // (que ficava obsoleto e mostrava mensal como semanal). As sessões de recorrência futuras dizem a
    // frequência; quantos horários ela tem é a própria frequência quem diz (doc 71), não a contagem
    // de pares distintos — ver `slotsRecorrentes`.
    db.select({ pid: therapySessions.patientId, date: therapySessions.date, freq: therapySessions.recurrenceFreq })
      .from(therapySessions)
      .where(and(
        eq(therapySessions.userId, userId),
        eq(therapySessions.recurring, true),
        sql`${therapySessions.date} >= now()`,
        ne(therapySessions.status, "cancelada"),
      )),
  ]);

  const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  const proximaPorPaciente = new Map(
    proximas.map((r) => {
      const d = new Date(r.data);
      return [r.pid, { dia: DIAS[d.getDay()], hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }];
    }),
  );
  /**
   * Frequência REAL por paciente, derivada das sessões de recorrência futuras (doc 9, #14).
   *
   * Doc 71: quantos horários o combinado tem é a FREQUÊNCIA quem diz (`semanal2x` → dois), não a
   * contagem de pares distintos que apareceram na agenda. Um atendimento remarcado para outro dia
   * é um par a mais e fazia a lista anunciar um segundo horário semanal que não existe — a Yngrid,
   * semanal na segunda, virava "Semanal 2x · Segunda 20:00, Terça 17:00" por causa de UMA sessão.
   * Quais slots valem é `slotsRecorrentes`, a mesma apuração da frase da ficha.
   *
   * As datas passam por `horaDeParede` antes de virar dia+hora: a coluna guarda hora de parede e o
   * Drizzle a entrega nos campos UTC do objeto (ver `lib/horaLocal`). Sem isso, a lista acerta no
   * servidor da Vercel (que roda em UTC) e erra em qualquer outro fuso.
   */
  const recPorPaciente = new Map<string, { freq: string | null; datas: Date[] }>();
  for (const r of recorrentes) {
    const atual = recPorPaciente.get(r.pid) ?? { freq: r.freq, datas: [] };
    atual.datas.push(new Date(horaDeParede(r.date)));
    recPorPaciente.set(r.pid, atual);
  }
  const labelFrequencia = (pid: string, fallbackFreq: string | null): string => {
    const rec = recPorPaciente.get(pid);
    if (!rec) return rotuloFrequenciaReal(null, []); // sem recorrência futura
    const freq = rec.freq ?? fallbackFreq;
    const slots = slotsRecorrentes(rec.datas.map((date) => ({ date })), ehSemanal2x(freq) ? 2 : 1);
    return rotuloFrequenciaReal(freq, slots);
  };

  const paidMap = new Map(paysByPatient.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const debitMap = new Map(debitByPatient.map((r) => [r.pid, parseFloat(r.total || "0")]));

  // Situação (em dia / em aberto / atrasado) pelo motor único, em lote (dono, 16/09/2026).
  const situacoes = await situacoesDaLista(userId, list.map((p) => ({
    id: p.id, paymentFormat: p.paymentFormat, pacoteTipo: p.pacoteTipo, sessionFee: p.sessionFee,
    paymentDay: p.paymentDay, paymentDay2: p.paymentDay2, timesPerPeriod: p.timesPerPeriod, horasAntesPagamento: p.horasAntesPagamento,
    sessionsInPacket: p.sessionsInPacket,
  })));

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Cadastros</h1>
          <p className="text-foreground/50 mt-1">{list.length} cadastro(s) no consultório</p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" /> <span>Novo cadastro</span>
        </Link>
      </div>

      <PatientsClient
        patients={list.map((p) => {
          const fee = parseFloat(p.sessionFee || "0") || 0;
          const bal = (paidMap.get(p.id) ?? 0) - (debitMap.get(p.id) ?? 0);
          const creditSessions = fee > 0 && bal > 0 ? Math.floor(bal / fee) : 0;
          const debtSessions = fee > 0 && bal < 0 ? Math.ceil(-bal / fee) : 0;
          const sit = situacoes.get(p.id);
          return {
            id: p.id,
            name: p.name,
            registrationNumber: p.registrationNumber,
            phone: p.phone,
            email: p.email,
            agendaId: p.agendaId,
            patientStatus: p.patientStatus,
            paymentStatus: p.paymentStatus,
            sessionFee: p.sessionFee,
            frequency: p.frequency,
            frequenciaLabel: labelFrequencia(p.id, p.frequency),
            paymentFormat: p.paymentFormat,
            pacoteTipo: p.pacoteTipo,
            tags: p.tags,
            attendanceDay: proximaPorPaciente.get(p.id)?.dia ?? p.attendanceDay,
            attendanceTime: proximaPorPaciente.get(p.id)?.hora ?? p.attendanceTime,
            balance: bal,
            creditSessions,
            debtSessions,
            situacao: sit?.situacao ?? "em_dia",
            nAberto: sit?.nAberto ?? 0,
            nAtraso: sit?.nAtraso ?? 0,
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : "",
          };
        })}
        initial={{ status: sp.status, tipo: sp.tipo, dia: sp.dia, tag: sp.tag }}
      />
    </div>
  );
}
