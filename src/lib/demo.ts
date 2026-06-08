import "server-only";
import { db } from "@/db";
import {
  users, patients, therapySessions, sessionPayments, patientPackages, transactions,
  financialAccounts, patientRecords, assignments, scaleApplications, moodLogs, treatmentGoals,
  patientStatusHistory, patientPriceHistory, patientContractHistory, goals, achievements, socialPosts,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { wipeUserData } from "@/scripts/seedCore";
import bcrypt from "bcryptjs";

export const DEMO_EMAIL = "demo@ledivan.com.br";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "ledivan-demo-2026";
const SOURCE_EMAIL = "apoiador@ledivan.com.br";

const uid = () => crypto.randomUUID();
async function chunkInsert(table: any, rows: any[], size = 200) {
  for (let i = 0; i < rows.length; i += size) await db.insert(table).values(rows.slice(i, i + size));
}

// Garante a conta demo (fixa) e retorna seu id.
async function ensureDemoUser(): Promise<string> {
  let u = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  if (!u) {
    [u] = await db.insert(users).values({
      email: DEMO_EMAIL, name: "Conta Demonstração", passwordHash, emailVerified: new Date(),
      isDemo: true, role: "user", acceptedTermsAt: new Date(), acceptedPrivacyAt: new Date(),
    }).returning();
  } else {
    await db.update(users).set({ isDemo: true, passwordHash, acceptedTermsAt: new Date(), acceptedPrivacyAt: new Date() }).where(eq(users.id, u.id));
  }
  return u.id;
}

// Clona TODO o domínio do apoiador para a conta demo (buffer descartável).
// Reset: cada visita zera a demo e recopia o snapshot do apoiador (originais intactos).
export async function resetDemoFromSource(): Promise<void> {
  const src = await db.query.users.findFirst({ where: eq(users.email, SOURCE_EMAIL) });
  if (!src) throw new Error("Conta fonte (apoiador) não encontrada.");
  const dst = await ensureDemoUser();
  await wipeUserData(dst);

  const srcId = src.id;
  // espelha alguns ajustes do perfil (locais de atendimento etc.)
  await db.update(users).set({ attendanceLocations: src.attendanceLocations, photo3x4: src.photo3x4 }).where(eq(users.id, dst));

  // mapas de id antigo → novo
  const mAcc = new Map<string, string>();
  const mPat = new Map<string, string>();
  const mSess = new Map<string, string>();
  const mTx = new Map<string, string>();
  const mPkg = new Map<string, string>();

  const accts = await db.query.financialAccounts.findMany({ where: eq(financialAccounts.userId, srcId) });
  await chunkInsert(financialAccounts, accts.map((r) => { const id = uid(); mAcc.set(r.id, id); return { ...r, id, userId: dst }; }));

  const pats = await db.query.patients.findMany({ where: eq(patients.userId, srcId) });
  await chunkInsert(patients, pats.map((r) => { const id = uid(); mPat.set(r.id, id); return { ...r, id, userId: dst, moodToken: uid().replace(/-/g, "") }; }));

  const pkgs = await db.query.patientPackages.findMany({ where: eq(patientPackages.userId, srcId) });
  await chunkInsert(patientPackages, pkgs.map((r) => { const id = uid(); mPkg.set(r.id, id); return { ...r, id, userId: dst, patientId: mPat.get(r.patientId)! }; }));

  const sess = await db.query.therapySessions.findMany({ where: eq(therapySessions.userId, srcId) });
  await chunkInsert(therapySessions, sess.map((r) => { const id = uid(); mSess.set(r.id, id); return { ...r, id, userId: dst, patientId: mPat.get(r.patientId)! }; }));

  const txs = await db.query.transactions.findMany({ where: eq(transactions.userId, srcId) });
  await chunkInsert(transactions, txs.map((r) => { const id = uid(); mTx.set(r.id, id); return { ...r, id, userId: dst, accountId: r.accountId ? (mAcc.get(r.accountId) ?? null) : null }; }));

  const pays = await db.query.sessionPayments.findMany({ where: eq(sessionPayments.userId, srcId) });
  await chunkInsert(sessionPayments, pays.map((r) => ({
    ...r, id: uid(), userId: dst,
    patientId: mPat.get(r.patientId)!,
    sessionId: r.sessionId ? (mSess.get(r.sessionId) ?? null) : null,
    linkedTransactionId: r.linkedTransactionId ? (mTx.get(r.linkedTransactionId) ?? null) : null,
    packageId: r.packageId ? (mPkg.get(r.packageId) ?? null) : null,
  })));

  const recs = await db.query.patientRecords.findMany({ where: eq(patientRecords.userId, srcId) });
  await chunkInsert(patientRecords, recs.map((r) => ({ ...r, id: uid(), userId: dst, patientId: mPat.get(r.patientId)!, sessionId: r.sessionId ? (mSess.get(r.sessionId) ?? null) : null })));

  const asg = await db.query.assignments.findMany({ where: eq(assignments.userId, srcId) });
  await chunkInsert(assignments, asg.map((r) => ({ ...r, id: uid(), userId: dst, patientId: mPat.get(r.patientId)!, token: uid().replace(/-/g, "") })));

  const sc = await db.query.scaleApplications.findMany({ where: eq(scaleApplications.userId, srcId) });
  await chunkInsert(scaleApplications, sc.map((r) => ({ ...r, id: uid(), userId: dst, patientId: mPat.get(r.patientId)!, token: uid().replace(/-/g, "") })));

  const md = await db.query.moodLogs.findMany({ where: eq(moodLogs.userId, srcId) });
  await chunkInsert(moodLogs, md.map((r) => ({ ...r, id: uid(), userId: dst, patientId: mPat.get(r.patientId)! })));

  const tg = await db.query.treatmentGoals.findMany({ where: eq(treatmentGoals.userId, srcId) });
  await chunkInsert(treatmentGoals, tg.map((r) => ({ ...r, id: uid(), userId: dst, patientId: mPat.get(r.patientId)! })));

  const patIds = pats.map((p) => p.id);
  if (patIds.length) {
    const remap = (r: any) => ({ ...r, id: uid(), patientId: mPat.get(r.patientId)! });
    const sh = await db.select().from(patientStatusHistory).where(inArray(patientStatusHistory.patientId, patIds));
    await chunkInsert(patientStatusHistory, sh.map(remap));
    const ph = await db.select().from(patientPriceHistory).where(inArray(patientPriceHistory.patientId, patIds));
    await chunkInsert(patientPriceHistory, ph.map(remap));
    const ch = await db.select().from(patientContractHistory).where(inArray(patientContractHistory.patientId, patIds));
    await chunkInsert(patientContractHistory, ch.map(remap));
  }

  const gs = await db.query.goals.findMany({ where: eq(goals.userId, srcId) });
  await chunkInsert(goals, gs.map((r) => ({ ...r, id: uid(), userId: dst })));
  const ach = await db.query.achievements.findMany({ where: eq(achievements.userId, srcId) });
  await chunkInsert(achievements, ach.map((r) => ({ ...r, id: uid(), userId: dst })));
  const sp = await db.query.socialPosts.findMany({ where: eq(socialPosts.userId, srcId) });
  await chunkInsert(socialPosts, sp.map((r) => ({ ...r, id: uid(), userId: dst })));
}
