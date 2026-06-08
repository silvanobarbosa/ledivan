import { db } from "@/db";
import { getAdmin } from "@/lib/admin";
import { notFound } from "next/navigation";
import { users, patients, therapySessions, transactions, sessionPayments, patientPackages, assignments, scaleApplications, moodLogs } from "@/db/schema";
import { and, eq, count, sum, sql, inArray } from "drizzle-orm";
import { BarChart3, Users, CalendarDays, Wallet, Package, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) notFound();

  const allUsers = await db.query.users.findMany({
    columns: { id: true, isDemo: true, role: true, acceptedTermsAt: true, whatsappConnected: true, emailConfigured: true, createdAt: true },
  });
  const realIds = allUsers.filter((u) => !u.isDemo).map((u) => u.id);
  const demoCount = allUsers.filter((u) => u.isDemo).length;

  // restringe a usuários reais (exclui contas demo efêmeras)
  const inReal = (col: any) => realIds.length ? inArray(col, realIds) : sql`false`;

  const [patByStatus, sessByStatus, sessFlags, txAgg, payCount, pkgAgg, featPkg, featRec, featOnline, featTasks, featScales, featMood] = await Promise.all([
    db.select({ s: patients.patientStatus, n: count() }).from(patients).where(inReal(patients.userId)).groupBy(patients.patientStatus),
    db.select({ s: therapySessions.status, n: count() }).from(therapySessions).where(inReal(therapySessions.userId)).groupBy(therapySessions.status),
    db.select({
      online: sql<number>`count(*) filter (where ${therapySessions.isOnline})::int`,
      reservas: sql<number>`count(*) filter (where ${therapySessions.pendingConfirmation})::int`,
      recorrentes: sql<number>`count(*) filter (where ${therapySessions.recurring})::int`,
      total: count(),
    }).from(therapySessions).where(inReal(therapySessions.userId)),
    db.select({ t: transactions.type, v: sum(transactions.amount) }).from(transactions).where(inReal(transactions.userId)).groupBy(transactions.type),
    db.select({ n: count() }).from(sessionPayments).where(inReal(sessionPayments.userId)),
    db.select({ n: count(), open: sql<number>`coalesce(sum(${patientPackages.sessions} - ${patientPackages.used}),0)::int` }).from(patientPackages).where(inReal(patientPackages.userId)),
    db.selectDistinct({ u: patientPackages.userId }).from(patientPackages).where(inReal(patientPackages.userId)),
    db.selectDistinct({ u: therapySessions.userId }).from(therapySessions).where(and(inReal(therapySessions.userId), eq(therapySessions.recurring, true))),
    db.selectDistinct({ u: therapySessions.userId }).from(therapySessions).where(and(inReal(therapySessions.userId), eq(therapySessions.isOnline, true))),
    db.selectDistinct({ u: assignments.userId }).from(assignments).where(inReal(assignments.userId)),
    db.selectDistinct({ u: scaleApplications.userId }).from(scaleApplications).where(inReal(scaleApplications.userId)),
    db.selectDistinct({ u: moodLogs.userId }).from(moodLogs).where(inReal(moodLogs.userId)),
  ]);

  const totalUsers = realIds.length;
  const pat = (k: string) => Number(patByStatus.find((r) => r.s === k)?.n || 0);
  const sess = (k: string) => Number(sessByStatus.find((r) => r.s === k)?.n || 0);
  const income = Number(txAgg.find((r) => r.t === "income")?.v || 0);
  const expense = Number(txAgg.find((r) => r.t === "expense")?.v || 0);
  const sf = sessFlags[0] || { online: 0, reservas: 0, recorrentes: 0, total: 0 };

  const pct = (n: number) => totalUsers ? Math.round((n / totalUsers) * 100) : 0;
  const adoption = [
    { label: "Pacotes", n: featPkg.length },
    { label: "Agenda recorrente", n: featRec.length },
    { label: "Atendimento online", n: featOnline.length },
    { label: "Tarefas (atividades)", n: featTasks.length },
    { label: "Escalas (PHQ/GAD)", n: featScales.length },
    { label: "Diário de humor", n: featMood.length },
    { label: "WhatsApp conectado", n: allUsers.filter((u) => !u.isDemo && u.whatsappConnected).length },
    { label: "E-mail configurado", n: allUsers.filter((u) => !u.isDemo && u.emailConfigured).length },
  ];
  const indexUso = adoption.length ? Math.round(adoption.reduce((a, f) => a + pct(f.n), 0) / adoption.length) : 0;
  const consent = allUsers.filter((u) => !u.isDemo && u.acceptedTermsAt).length;

  const Card = ({ icon: Icon, title, children }: any) => (
    <div className="glass-card rounded-[24px] p-5">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest flex items-center gap-2 mb-3"><Icon className="w-4 h-4" /> {title}</p>
      {children}
    </div>
  );
  const Stat = ({ n, l, c = "text-primary" }: { n: React.ReactNode; l: string; c?: string }) => (
    <div><p className={`text-2xl font-display font-bold ${c}`}>{n}</p><p className="text-xs text-foreground/50">{l}</p></div>
  );

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2"><BarChart3 className="w-7 h-7" /> Observabilidade do sistema</h1>
        <p className="text-foreground/50 mt-1">Métricas agregadas e anonimizadas (sem nomes, e-mails ou dados de pacientes — LGPD). Contas demo excluídas.</p>
      </div>

      <div className="rounded-[24px] p-5 bg-gradient-to-br from-primary to-[#5b2d7a] text-white flex items-center justify-between flex-wrap gap-4">
        <div><p className="text-5xl font-display font-bold">{indexUso}%</p><p className="text-white/70 text-sm">Índice de adoção (média de uso dos recursos)</p></div>
        <div className="flex gap-6 text-sm">
          <div><p className="text-2xl font-bold">{totalUsers}</p><p className="text-white/60">terapeutas</p></div>
          <div><p className="text-2xl font-bold">{demoCount}</p><p className="text-white/60">sessões demo ativas</p></div>
          <div><p className="text-2xl font-bold">{consent}</p><p className="text-white/60">consentiram</p></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card icon={Users} title="Pacientes">
          <div className="grid grid-cols-2 gap-3">
            <Stat n={pat("ativo")} l="ativos" c="text-[#047857]" />
            <Stat n={pat("pausado")} l="pausados" c="text-[#b45309]" />
            <Stat n={pat("inativo")} l="inativos" c="text-foreground/50" />
            <Stat n={pat("prospect")} l="prospects" c="text-secondary" />
          </div>
        </Card>
        <Card icon={CalendarDays} title="Sessões">
          <div className="grid grid-cols-2 gap-3">
            <Stat n={sf.total} l="total" />
            <Stat n={sess("realizada")} l="realizadas" c="text-[#047857]" />
            <Stat n={sf.reservas} l="reservas" c="text-[#b45309]" />
            <Stat n={sf.recorrentes} l="recorrentes" c="text-[#1e40af]" />
            <Stat n={sf.online} l="online" c="text-secondary" />
            <Stat n={sess("cancelada") + sess("nao_realizada")} l="não realizadas" c="text-[#b91c1c]" />
          </div>
        </Card>
        <Card icon={Wallet} title="Financeiro (agregado)">
          <div className="grid grid-cols-1 gap-3">
            <Stat n={brl(income)} l="receitas lançadas" c="text-[#047857]" />
            <Stat n={brl(expense)} l="despesas lançadas" c="text-[#b91c1c]" />
            <Stat n={Number(payCount[0]?.n || 0)} l="pagamentos registrados" />
          </div>
        </Card>
        <Card icon={Package} title="Pacotes">
          <div className="grid grid-cols-2 gap-3">
            <Stat n={Number(pkgAgg[0]?.n || 0)} l="pacotes criados" />
            <Stat n={Number(pkgAgg[0]?.open || 0)} l="sessões em aberto" c="text-[#1e40af]" />
          </div>
        </Card>
        <Card icon={ShieldCheck} title="Conformidade">
          <div className="grid grid-cols-2 gap-3">
            <Stat n={consent} l="aceitaram termos" c="text-[#047857]" />
            <Stat n={totalUsers - consent} l="pendentes" c="text-[#b45309]" />
          </div>
        </Card>
      </div>

      <Card icon={BarChart3} title="Adoção de recursos (terapeutas que usam)">
        <div className="space-y-2">
          {adoption.map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-44 text-sm text-foreground/70 shrink-0">{f.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-surface overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${pct(f.n)}%` }} />
              </div>
              <span className="w-16 text-right text-sm font-semibold text-primary">{f.n} ({pct(f.n)}%)</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
