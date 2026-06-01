import { db } from "@/db";
import { auth } from "@/auth";
import { patients, therapySessions, scaleApplications, moodLogs } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import { AlertTriangle, TrendingDown, CalendarX, DollarSign, ChevronRight, ShieldCheck } from "lucide-react";
import { riskFromSessions } from "@/lib/therapy";
import { SCALES, type ScaleType } from "@/lib/scales";

export const dynamic = "force-dynamic";

type Flag = { label: string; icon: "risk" | "scale" | "mood" | "pay"; tone: "alerta" | "grave" };

export default async function ClinicoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const pats = await db.query.patients.findMany({
    where: and(eq(patients.userId, userId), inArray(patients.patientStatus, ["ativo", "pausado"])),
  });
  const patIds = pats.map((p) => p.id);

  const [sessions, scales, moods] = patIds.length
    ? await Promise.all([
        db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
        db.query.scaleApplications.findMany({ where: and(eq(scaleApplications.userId, userId), eq(scaleApplications.status, "respondida")), orderBy: [desc(scaleApplications.appliedAt)] }),
        db.query.moodLogs.findMany({ where: eq(moodLogs.userId, userId), orderBy: [desc(moodLogs.loggedAt)] }),
      ])
    : [[], [], []];

  const sessionsByPatient = new Map<string, { status: string; date: Date }[]>();
  for (const s of sessions) {
    const arr = sessionsByPatient.get(s.patientId) ?? [];
    arr.push({ status: s.status, date: s.date as Date });
    sessionsByPatient.set(s.patientId, arr);
  }
  const latestScaleByPatient = new Map<string, typeof scales[number]>();
  for (const s of scales) if (!latestScaleByPatient.has(s.patientId)) latestScaleByPatient.set(s.patientId, s);
  const moodsByPatient = new Map<string, number[]>();
  for (const m of moods) {
    const arr = moodsByPatient.get(m.patientId) ?? [];
    if (arr.length < 5) arr.push(m.mood);
    moodsByPatient.set(m.patientId, arr);
  }

  const flagged = pats
    .map((p) => {
      const flags: Flag[] = [];
      const risk = riskFromSessions(sessionsByPatient.get(p.id) ?? []);
      if (risk.level === "alto") flags.push({ label: "Risco alto de falta", icon: "risk", tone: "alerta" });

      const sc = latestScaleByPatient.get(p.id);
      if (sc && sc.score != null) {
        const def = SCALES[sc.scaleType as ScaleType];
        const sev = def.severity(sc.score);
        if (sev.tone === "grave" || sev.tone === "alerta") {
          flags.push({ label: `${def.short} ${sev.label.toLowerCase()} (${sc.score}/${def.max})`, icon: "scale", tone: sev.tone === "grave" ? "grave" : "alerta" });
        }
      }

      const ms = moodsByPatient.get(p.id) ?? [];
      if (ms.length >= 3) {
        const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
        if (avg <= 2.5) flags.push({ label: `Humor baixo (média ${avg.toFixed(1)})`, icon: "mood", tone: avg <= 2 ? "grave" : "alerta" });
      }

      if (p.paymentStatus === "overdue") flags.push({ label: "Pagamento atrasado", icon: "pay", tone: "alerta" });

      const score = flags.reduce((a, f) => a + (f.tone === "grave" ? 2 : 1), 0);
      return { p, flags, score };
    })
    .filter((x) => x.flags.length > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Atenção clínica</h1>
        <p className="text-foreground/50 mt-1">Pacientes que merecem um olhar agora.</p>
      </div>

      {flagged.length === 0 ? (
        <div className="glass-card rounded-[28px] p-10 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-[#047857] mx-auto" />
          <p className="font-display text-xl text-primary">Tudo tranquilo por aqui</p>
          <p className="text-foreground/50 text-sm">Nenhum paciente em alerta no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {flagged.map(({ p, flags }) => (
            <Link key={p.id} href={`/dashboard/patients/${p.id}`} className="glass-card rounded-[24px] p-5 flex items-center gap-4 hover:shadow-lg transition group">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{p.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {flags.map((f, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${f.tone === "grave" ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-[#fffbeb] text-[#b45309]"}`}>
                      <FlagIcon kind={f.icon} /> {f.label}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FlagIcon({ kind }: { kind: "risk" | "scale" | "mood" | "pay" }) {
  const cls = "w-3 h-3";
  if (kind === "risk") return <CalendarX className={cls} />;
  if (kind === "scale") return <AlertTriangle className={cls} />;
  if (kind === "mood") return <TrendingDown className={cls} />;
  return <DollarSign className={cls} />;
}
