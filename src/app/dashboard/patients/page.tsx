import { db } from "@/db";
import { auth } from "@/auth";
import { patients, sessionPayments, therapySessions } from "@/db/schema";
import { and, eq, asc, ne, sql } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PatientsClient } from "./PatientsClient";
import { situacoesDaLista } from "@/lib/situacoesLista";
import { rotuloFrequenciaReal } from "@/lib/rotulosPaciente";

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
    // frequência e os dia/hora distintos (1 slot = 1x, 2 slots = 2x).
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
  // Frequência REAL por paciente, derivada das sessões de recorrência futuras (doc 9, #14): a
  // frequência (mensal/quinzenal/semanal) e os slots dia/hora DISTINTOS. 2 slots distintos = Semanal 2x.
  const recPorPaciente = new Map<string, { freq: string | null; slots: { dia: string; hora: string }[] }>();
  for (const r of recorrentes) {
    const d = new Date(r.date);
    const slot = { dia: DIAS[d.getDay()], hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
    const atual = recPorPaciente.get(r.pid) ?? { freq: r.freq, slots: [] };
    if (!atual.slots.some((s) => s.dia === slot.dia && s.hora === slot.hora)) atual.slots.push(slot);
    recPorPaciente.set(r.pid, atual);
  }
  const DIA_ORDEM = (dia: string) => DIAS.indexOf(dia);
  const labelFrequencia = (pid: string, fallbackFreq: string | null): string => {
    const rec = recPorPaciente.get(pid);
    if (!rec) return rotuloFrequenciaReal(null, []); // sem recorrência futura
    const slots = rec.slots.slice().sort((a, b) => DIA_ORDEM(a.dia) - DIA_ORDEM(b.dia) || a.hora.localeCompare(b.hora));
    return rotuloFrequenciaReal(rec.freq ?? fallbackFreq, slots);
  };

  const paidMap = new Map(paysByPatient.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const debitMap = new Map(debitByPatient.map((r) => [r.pid, parseFloat(r.total || "0")]));

  // Situação (em dia / em aberto / atrasado) pelo motor único, em lote (dono, 16/09/2026).
  const situacoes = await situacoesDaLista(userId, list.map((p) => ({
    id: p.id, paymentFormat: p.paymentFormat, pacoteTipo: p.pacoteTipo, sessionFee: p.sessionFee,
    paymentDay: p.paymentDay, paymentDay2: p.paymentDay2, timesPerPeriod: p.timesPerPeriod, horasAntesPagamento: p.horasAntesPagamento,
  })));

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Pacientes</h1>
          <p className="text-foreground/50 mt-1">{list.length} paciente(s) no consultório</p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" /> <span>Novo paciente</span>
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
