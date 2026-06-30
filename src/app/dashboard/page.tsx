import { db } from "@/db";
import { auth } from "@/auth";
import { users, patients, therapySessions, patientPackages } from "@/db/schema";
import { eq, sql, count, and } from "drizzle-orm";
import { formatDateTime } from "@/lib/therapy";
import { Users as UsersIcon, CalendarCheck, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return <div>Você precisa estar logado para acessar o dashboard.</div>;
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) return <div>Usuário não encontrado.</div>;

  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const now = new Date();
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();

  const [activeRows, weekRows, upcomingSessions, reservasRows, pkgEndingRows, analiticosRows] = await Promise.all([
    db.select({ val: count() }).from(patients).where(and(eq(patients.userId, user.id), eq(patients.patientStatus, "ativo"))),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${weekStart} AND ${therapySessions.date} < ${weekEnd}`),
    db.query.therapySessions.findMany({
      where: sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${now} AND ${therapySessions.status} = 'agendada' AND ${therapySessions.pendingConfirmation} = false`,
      with: { patient: { columns: { name: true, id: true } } },
      orderBy: [therapySessions.date],
      limit: 6,
    }),
    db.select({ val: count() }).from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${now} AND ${therapySessions.pendingConfirmation} = true`),
    db.select({ pid: patientPackages.patientId, rem: sql<number>`sum(${patientPackages.sessions} - ${patientPackages.used})::int` })
      .from(patientPackages).innerJoin(patients, eq(patientPackages.patientId, patients.id))
      .where(and(eq(patientPackages.userId, user.id), eq(patients.patientStatus, "ativo"), eq(patients.contractType, "pacote")))
      .groupBy(patientPackages.patientId),
    db.select({ status: therapySessions.status, isOnline: therapySessions.isOnline })
      .from(therapySessions).where(sql`${therapySessions.userId} = ${user.id} AND ${therapySessions.date} >= ${ninetyDaysAgo} AND ${therapySessions.date} <= ${now}`),
  ]);

  const activePatients = Number(activeRows[0]?.val || 0);
  const weekSessions = Number(weekRows[0]?.val || 0);
  const reservasCount = Number(reservasRows[0]?.val || 0);
  const pacotesAcabando = pkgEndingRows.filter((r) => Number(r.rem) === 1).length;

  const anRealizados = analiticosRows.filter((r) => r.status === "realizada");
  const anTotal = anRealizados.length;
  const anOnline = anRealizados.filter((r) => r.isOnline).length;
  const anPresencial = anTotal - anOnline;
  const anFaltas = analiticosRows.filter((r) => r.status === "nao_realizada").length;
  const anCancel = analiticosRows.filter((r) => r.status === "cancelada").length;
  const anPct = (n: number) => (anTotal ? Math.round((n / anTotal) * 100) : 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <section className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary bg-[#ede4fb] px-3 py-1.5 rounded-full mb-2">🌿 Atendimento</div>
        <h2 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">Olá, {(user.name || "Terapeuta").split(" ")[0]}!</h2>
        <p className="text-foreground/40 font-medium">Resumo do seu consultório hoje.</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/patients?status=ativo" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><UsersIcon className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{activePatients}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Pacientes ativos <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
        <Link href="/dashboard/agenda" className="glass-card rounded-[28px] p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.99] transition group">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0"><CalendarCheck className="w-6 h-6" /></div>
          <div className="min-w-0"><p className="text-2xl font-display font-bold text-primary leading-none">{weekSessions}</p><p className="text-sm text-foreground/50 mt-1 flex items-center gap-1">Sessões na semana <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" /></p></div>
        </Link>
      </div>

      {(reservasCount > 0 || pacotesAcabando > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {reservasCount > 0 && (
            <Link href="/dashboard/reservas" className="flex items-center gap-3 bg-[#fffbeb] border border-[#fde68a] rounded-[28px] p-5 hover:shadow-md transition group">
              <div className="w-12 h-12 rounded-2xl bg-[#fef3c7] text-[#92400e] flex items-center justify-center text-xl shrink-0">⏳</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-[#92400e]">{reservasCount} reserva(s) a confirmar</p><p className="text-sm text-[#92400e]/70">Aguardando confirmação.</p></div>
              <ChevronRight className="w-5 h-5 text-[#92400e]/50 group-hover:translate-x-1 transition shrink-0" />
            </Link>
          )}
          {pacotesAcabando > 0 && (
            <Link href="/dashboard/pacotes-acabando" className="flex items-center gap-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-[28px] p-5 hover:shadow-md transition group">
              <div className="w-12 h-12 rounded-2xl bg-[#dbeafe] text-[#1e40af] flex items-center justify-center text-xl shrink-0">📦</div>
              <div className="flex-1 min-w-0"><p className="font-bold text-[#1e40af]">{pacotesAcabando} com pacote acabando</p><p className="text-sm text-[#1e40af]/70">Resta 1 sessão — renovar.</p></div>
              <ChevronRight className="w-5 h-5 text-[#1e40af]/50 group-hover:translate-x-1 transition shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Próximas sessões */}
      <div className="bg-white rounded-[28px] border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-bold text-primary flex items-center gap-2"><Clock className="w-5 h-5" /> Próximas sessões</h3>
          <Link href="/dashboard/agenda" className="text-sm font-semibold text-accent hover:underline">Ver agenda</Link>
        </div>
        {upcomingSessions.length === 0 ? (
          <p className="text-foreground/40 text-sm">Nenhuma sessão agendada.</p>
        ) : (
          <div className="grid gap-2">
            {upcomingSessions.map((s) => {
              const past = new Date(s.date as unknown as string).getTime() < todayStart;
              const Row = (
                <>
                  <span className="font-mono text-sm font-semibold text-primary shrink-0">{formatDateTime(s.date as unknown as string)}</span>
                  <span className="flex-1 font-medium truncate">{s.patient?.name ?? "—"}</span>
                  <span className="text-xs text-foreground/40">{s.duration}min</span>
                  {!past && <span className="text-[11px] font-bold text-accent opacity-0 group-hover:opacity-100 transition">Atender →</span>}
                </>
              );
              return past
                ? <div key={s.id} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3">{Row}</div>
                : <Link key={s.id} href={`/atender/${s.id}`} className="flex items-center gap-3 bg-surface/60 rounded-2xl px-4 py-3 hover:bg-surface transition group">{Row}</Link>;
            })}
          </div>
        )}
      </div>

      {/* Analíticos (90 dias) */}
      <div className="bg-white rounded-[28px] border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-bold text-primary">Analíticos · últimos 90 dias</h3>
          <Link href="/dashboard/analiticos" className="text-sm font-semibold text-accent hover:underline">Ver tudo</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-primary">{anTotal}</p><p className="text-xs text-foreground/50">Realizados</p></div>
          <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-accent">{anOnline} <span className="text-xs font-normal text-foreground/40">({anPct(anOnline)}%)</span></p><p className="text-xs text-foreground/50">Online</p></div>
          <div className="rounded-2xl bg-surface/60 border border-border px-4 py-3"><p className="text-xl font-display font-bold text-[#047857]">{anPresencial} <span className="text-xs font-normal text-foreground/40">({anPct(anPresencial)}%)</span></p><p className="text-xs text-foreground/50">Presencial</p></div>
          <div className="rounded-2xl bg-[#fef2f2] border border-[#fecaca] px-4 py-3"><p className="text-xl font-display font-bold text-[#b91c1c]">{anFaltas}</p><p className="text-xs text-foreground/50">Faltas{anCancel ? ` · ${anCancel} canc.` : ""}</p></div>
        </div>
      </div>
    </div>
  );
}
