import { db } from "@/db";
import { patients, therapySessions, scaleApplications, moodLogs } from "@/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { riskFromSessions } from "@/lib/therapy";
import { SCALES, type ScaleType } from "@/lib/scales";

export type ClinicalFlag = { label: string; icon: "risk" | "scale" | "mood" | "pay"; tone: "alerta" | "grave" };
export type FlaggedPatient = { id: string; name: string; flags: ClinicalFlag[]; score: number };

// Cruza risco de falta, escalas, humor e pagamento para sinalizar pacientes que merecem atenção.
export async function getClinicalFlags(userId: string): Promise<FlaggedPatient[]> {
  const pats = await db.query.patients.findMany({
    where: and(eq(patients.userId, userId), inArray(patients.patientStatus, ["ativo", "pausado"])),
  });
  if (pats.length === 0) return [];

  const [sessions, scales, moods] = await Promise.all([
    db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    db.query.scaleApplications.findMany({ where: and(eq(scaleApplications.userId, userId), eq(scaleApplications.status, "respondida")), orderBy: [desc(scaleApplications.appliedAt)] }),
    db.query.moodLogs.findMany({ where: eq(moodLogs.userId, userId), orderBy: [desc(moodLogs.loggedAt)] }),
  ]);

  const sessionsByPatient = new Map<string, { status: string; date: Date }[]>();
  for (const s of sessions) {
    const arr = sessionsByPatient.get(s.patientId) ?? [];
    arr.push({ status: s.status, date: s.date as Date });
    sessionsByPatient.set(s.patientId, arr);
  }
  const latestScaleByPatient = new Map<string, (typeof scales)[number]>();
  for (const s of scales) if (!latestScaleByPatient.has(s.patientId)) latestScaleByPatient.set(s.patientId, s);
  const moodsByPatient = new Map<string, number[]>();
  for (const m of moods) {
    const arr = moodsByPatient.get(m.patientId) ?? [];
    if (arr.length < 5) arr.push(m.mood);
    moodsByPatient.set(m.patientId, arr);
  }

  return pats
    .map((p) => {
      const flags: ClinicalFlag[] = [];
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
      return { id: p.id, name: p.name, flags, score };
    })
    .filter((x) => x.flags.length > 0)
    .sort((a, b) => b.score - a.score);
}
