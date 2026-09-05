import { db } from "@/db";
import {
  patients, users, therapySessions, assignments, moodLogs, scaleApplications,
  patientDiary, patientDocument, treatmentGoals, sessionPayments,
} from "@/db/schema";
import { and, eq, gte, desc, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Como paciente (Srta. Dionísia) — Demonstração Ledivan",
  description: "Veja o lado do paciente: próxima sessão, tarefas, humor, escalas, diário, materiais, metas e pagamento. Conta de demonstração, somente leitura.",
};

const THERAPIST_EMAIL = "socrates@ledivan.com.br";
const PATIENT_EMAIL = "dionisia@demo.ledivan.com.br";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const MOOD_EMOJI = ["", "😔", "😕", "😐", "🙂", "😄"];

export default async function PacienteDemoPage() {
  const therapist = await db.query.users.findFirst({ where: eq(users.email, THERAPIST_EMAIL) });
  if (!therapist?.isDemo) notFound();
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.userId, therapist.id), eq(patients.email, PATIENT_EMAIL)),
  });
  if (!patient) notFound();

  const uid = therapist.id, pid = patient.id;
  const pix = (() => { try { return JSON.parse(therapist.preferences || "{}").pix ?? null; } catch { return null; } })();

  const [next] = await db.select({ date: therapySessions.date, isOnline: therapySessions.isOnline })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, uid), eq(therapySessions.patientId, pid), eq(therapySessions.status, "agendada"), gte(therapySessions.date, new Date())))
    .orderBy(asc(therapySessions.date)).limit(1);

  const tasks = await db.select().from(assignments).where(eq(assignments.patientId, pid)).orderBy(desc(assignments.createdAt)).limit(6);
  const moods = (await db.select({ mood: moodLogs.mood, at: moodLogs.loggedAt }).from(moodLogs).where(eq(moodLogs.patientId, pid)).orderBy(desc(moodLogs.loggedAt)).limit(14)).reverse();
  const scales = await db.select().from(scaleApplications).where(eq(scaleApplications.patientId, pid)).orderBy(asc(scaleApplications.appliedAt));
  const diary = await db.select().from(patientDiary).where(eq(patientDiary.patientId, pid)).orderBy(desc(patientDiary.createdAt)).limit(4);
  const docs = await db.select().from(patientDocument).where(eq(patientDocument.patientId, pid)).orderBy(desc(patientDocument.createdAt)).limit(4);
  const goals = await db.select().from(treatmentGoals).where(eq(treatmentGoals.patientId, pid)).orderBy(asc(treatmentGoals.createdAt));
  const [openPay] = await db.select().from(sessionPayments).where(and(eq(sessionPayments.patientId, pid), eq(sessionPayments.status, "pending"))).limit(1);

  const firstName = patient.name.replace(/^(Sr[a]?\.?|Srta\.?)\s+/i, "").split(" ")[0];

  const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="glass-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium text-[color:var(--brand-eggplant)]">{title}</h2>
        {hint && <span className="text-[11px] text-[color:var(--muted-foreground)]">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );

  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-5xl px-6 py-5 flex items-center justify-between">
        <Logo />
        <Link href="/como-funciona" className="text-sm font-semibold text-[color:var(--brand-eggplant)] hover:underline">← Como funciona</Link>
      </header>

      <div className="bg-[#dbeafe] border-y border-[#93c5fd] text-[#1e40af] text-xs sm:text-sm px-4 py-2 text-center">
        🧪 <strong>Demonstração — o lado do paciente</strong>. Você está vendo o app da <strong>Srta. Dionísia</strong>, paciente do Dr. Sócrates. Somente leitura.
      </div>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Cabeçalho do paciente */}
          <div className="glass-card-lg p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[color:var(--brand-eggplant)]/10 flex items-center justify-center text-2xl">🌿</div>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">Olá,</p>
            <h1 className="font-display text-2xl font-medium text-[color:var(--brand-eggplant)]">{firstName}</h1>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">acompanhada por {therapist.name}</p>
          </div>

          {/* Próxima sessão */}
          <Section title="Próxima sessão">
            {next ? (
              <div className="flex items-center gap-3">
                <div className="text-2xl">{next.isOnline ? "🎥" : "🏢"}</div>
                <div>
                  <p className="font-semibold capitalize">{fmtDateTime(new Date(next.date))}</p>
                  <p className="text-sm text-[color:var(--muted-foreground)]">{next.isOnline ? "Sessão por vídeo" : "Presencial"} · 50 min</p>
                </div>
              </div>
            ) : <p className="text-sm text-[color:var(--muted-foreground)]">Nenhuma sessão agendada.</p>}
          </Section>

          {/* Tarefas */}
          <Section title="Minhas tarefas" hint={`${tasks.filter(t => t.status !== "respondida").length} pendente(s)`}>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <span className={`mt-0.5 text-sm ${t.status === "respondida" ? "text-green-600" : "text-amber-500"}`}>{t.status === "respondida" ? "✓" : "○"}</span>
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.responseText && <p className="text-xs text-[color:var(--muted-foreground)] italic">“{t.responseText}”</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Humor */}
          <Section title="Meu humor" hint="últimos registros">
            <div className="flex items-end gap-1.5 h-16">
              {moods.map((m, i) => (
                <div key={i} className="flex-1 rounded-t bg-[color:var(--brand-eggplant)]/70" style={{ height: `${(m.mood / 5) * 100}%` }} title={`${MOOD_EMOJI[m.mood]} ${fmtDate(new Date(m.at))}`} />
              ))}
            </div>
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{moods.length} check-ins recentes</p>
          </Section>

          {/* Escalas */}
          <Section title="Questionários (PHQ-9 / GAD-7)" hint="acompanhamento">
            <ul className="space-y-1.5">
              {scales.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="uppercase text-xs font-semibold tracking-wide">{s.scaleType}</span>
                  <span className="text-[color:var(--muted-foreground)]">{s.appliedAt ? fmtDate(new Date(s.appliedAt)) : "—"}</span>
                  <span className="font-semibold">{s.score} · {s.severity}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Metas */}
          <Section title="Minhas metas">
            <ul className="space-y-3">
              {goals.map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-[color:var(--muted-foreground)]">{g.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
                    <div className="h-full bg-[color:var(--brand-eggplant)]" style={{ width: `${g.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* Diário */}
          <Section title="Meu diário">
            <ul className="space-y-2">
              {diary.map((d) => (
                <li key={d.id} className="text-sm">
                  <span className="text-[color:var(--muted-foreground)] text-xs">{fmtDate(new Date(d.createdAt))} · {MOOD_EMOJI[d.mood ?? 3]}</span>
                  <p>{d.content}</p>
                </li>
              ))}
            </ul>
          </Section>

          {/* Materiais */}
          <Section title="Materiais do terapeuta">
            <ul className="space-y-1.5">
              {docs.map((d) => (
                <li key={d.id} className="text-sm flex items-center gap-2">
                  <span>{d.kind === "link" ? "🔗" : "📄"}</span>
                  <span>{d.title}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Pagamento */}
          <Section title="Pagamento" hint={openPay ? "em aberto" : "em dia"}>
            {openPay ? (
              <div>
                <p className="text-sm">Valor em aberto: <strong>{fmtBRL(Number(openPay.amount))}</strong></p>
                {pix?.key && (
                  <div className="mt-2 rounded-xl bg-black/[0.03] p-3 text-xs">
                    <p className="text-[color:var(--muted-foreground)]">Pague por Pix (chave de {pix.name}):</p>
                    <p className="font-mono mt-1 break-all">{pix.key}</p>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-[color:var(--muted-foreground)]">Nada em aberto. 🎉</p>}
          </Section>

          <div className="pt-2 text-center">
            <Link href="/como-funciona" className="inline-block bg-[color:var(--brand-eggplant)] text-white px-6 py-3 rounded-2xl font-bold text-sm">Ver como funciona (ponta a ponta)</Link>
            <p className="mt-4 text-[11px] text-[color:var(--muted-foreground)]">Conta de demonstração · somente leitura · Ledivan</p>
          </div>
        </div>
      </main>
    </div>
  );
}
