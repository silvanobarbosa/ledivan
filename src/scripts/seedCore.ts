// Núcleo de seed reutilizável (apoiador e silvano). Popula dados ricos:
// pacientes variados, sessões (online c/ tracking), pagamentos, créditos de pacote,
// prontuário, tarefas, humor, escalas, plano, financeiro, metas, conquistas, posts.
// Idempotente: limpa os dados de domínio do usuário e recria.
import { db } from "../db";
import {
  users, categories, financialAccounts, transactions,
  patients, patientStatusHistory, patientPriceHistory, therapySessions, sessionPayments,
  patientRecords, assignments, scaleApplications, moodLogs, treatmentGoals, patientPackages,
  consentForms, patientConsents, patientContractHistory, patientDiary, sessionRatings,
  patientDocument, messages, messageLog, patientDailyStatus, patientWriting,
} from "../db/schema";
import { and, eq, inArray, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export type SeedCfg = {
  email: string;
  name: string;
  password?: string;
  bookingSlug?: string;
  months: number;
  active: number;
  paused: number;
  inactive: number;
  prospects: number;
};

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rnd(0, arr.length - 1)];
const chance = (p: number) => Math.random() < p;
const money = (n: number) => n.toFixed(2);
const uuid = () => crypto.randomUUID();
const token = () => uuid().replace(/-/g, "") + uuid().replace(/-/g, "").slice(0, 8);

async function chunkInsert<T>(table: any, rows: T[], size = 200) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}
async function ensureCategory(name: string, type: "income" | "expense", icon: string, color: string) {
  const existing = await db.query.categories.findFirst({ where: eq(categories.name, name) });
  if (existing) return existing.id;
  const [c] = await db.insert(categories).values({ name, type, icon, color }).returning();
  return c.id;
}
function phqSeverity(s: number) { return s >= 20 ? "grave" : s >= 15 ? "moderadamente grave" : s >= 10 ? "moderada" : s >= 5 ? "leve" : "mínima"; }
function gadSeverity(s: number) { return s >= 15 ? "grave" : s >= 10 ? "moderada" : s >= 5 ? "leve" : "mínima"; }

const LOCATIONS = [
  { name: "Consultório Centro", address: "Av. Paulista, 1000 — sala 52, São Paulo/SP" },
  { name: "Clínica Jardins", address: "Rua Oscar Freire, 200 — São Paulo/SP" },
  { name: "Espaço Pinheiros", address: "Rua dos Pinheiros, 850 — São Paulo/SP" },
];
const locLabel = (l: { name: string; address: string }) => `${l.name} — ${l.address}`;
const WEEK_DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Motivos de inadimplência (para "por que está devendo")
const DEBT_REASONS = [
  "Atraso no pagamento — combinado acerto no próximo encontro.",
  "Acumulou sessões sem pagar (pacote vencido a renovar).",
  "Pagamento mensal em atraso há algumas semanas.",
  "Sessões cobradas acima do crédito disponível.",
  "Aguardando reembolso do convênio para quitar.",
];

// Apaga todos os dados de domínio de um usuário (mantém a conta).
export async function wipeUserData(uid: string) {
  const pats = await db.query.patients.findMany({ where: eq(patients.userId, uid) });
  const patIds = pats.map((p) => p.id);
  if (patIds.length) {
    await db.delete(patientStatusHistory).where(inArray(patientStatusHistory.patientId, patIds));
    await db.delete(patientPriceHistory).where(inArray(patientPriceHistory.patientId, patIds));
  }
  await db.delete(patientPackages).where(eq(patientPackages.userId, uid));
  await db.delete(sessionPayments).where(eq(sessionPayments.userId, uid));
  await db.delete(patientRecords).where(eq(patientRecords.userId, uid));
  await db.delete(assignments).where(eq(assignments.userId, uid));
  await db.delete(scaleApplications).where(eq(scaleApplications.userId, uid));
  await db.delete(moodLogs).where(eq(moodLogs.userId, uid));
  await db.delete(treatmentGoals).where(eq(treatmentGoals.userId, uid));
  await db.delete(therapySessions).where(eq(therapySessions.userId, uid));
  await db.delete(patients).where(eq(patients.userId, uid));
  await db.delete(transactions).where(eq(transactions.userId, uid));
  await db.delete(financialAccounts).where(eq(financialAccounts.userId, uid));
}

// Zera (sem recriar) os dados de um usuário pelo e-mail.
export async function wipeUser(email: string) {
  const u = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!u) { console.log(`(wipe) usuário ${email} não existe — nada a fazer.`); return; }
  await wipeUserData(u.id);
  console.log(`🧹 ${email} zerado (conta mantida, sem dados).`);
}

export async function runSeed(cfg: SeedCfg) {
  const { email: EMAIL, name: NAME, months: MONTHS } = cfg;
  console.log(`🌱 Seed ${EMAIL} — ${MONTHS} meses...`);

  const passwordHash = cfg.password ? await bcrypt.hash(cfg.password, 10) : undefined;
  const userPatch: any = { name: NAME, attendanceLocations: JSON.stringify(LOCATIONS) };
  if (passwordHash) { userPatch.passwordHash = passwordHash; userPatch.emailVerified = new Date(); }
  if (cfg.bookingSlug) userPatch.bookingSlug = cfg.bookingSlug;

  let user = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!user) {
    [user] = await db.insert(users).values({ email: EMAIL, ...userPatch }).returning();
    console.log(`👤 Usuário criado: ${user.id}`);
  } else {
    console.log(`👤 Usuário existente: ${user.id} — limpando domínio...`);
    await wipeUserData(user.id);
    await db.update(users).set(userPatch).where(eq(users.id, user.id));
  }
  const userId = user.id;

  const catSessions = await ensureCategory("Sessões", "income", "HeartHandshake", "#8b5cf6");
  const catOutras = await ensureCategory("Outras receitas", "income", "PlusCircle", "#16a34a");
  const catAluguel = await ensureCategory("Aluguel sala", "expense", "Building2", "#b45309");
  const catSuper = await ensureCategory("Supervisão", "expense", "GraduationCap", "#6b5b6f");
  const catMaterial = await ensureCategory("Material", "expense", "Package", "#0ea5e9");
  const catImpostos = await ensureCategory("Impostos", "expense", "Landmark", "#b91c1c");
  const catMkt = await ensureCategory("Marketing", "expense", "Megaphone", "#16a34a");
  const catSoftware = await ensureCategory("Software/Assinaturas", "expense", "Laptop", "#8b5cf6");

  const [contaPJ] = await db.insert(financialAccounts).values({ userId, name: "Conta PJ", type: "checking", balance: "0", color: "#2b1830" }).returning();
  await db.insert(financialAccounts).values({ userId, name: "Carteira", type: "cash", balance: "0", color: "#8b5cf6" });
  await db.insert(financialAccounts).values({ userId, name: "Poupança", type: "savings", balance: "0", color: "#047857" });

  const now = new Date();
  const start = new Date(now); start.setMonth(start.getMonth() - MONTHS); start.setDate(1);

  const firstNames = ["Ana", "Bruno", "Carla", "Diego", "Eliane", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcelo", "Natália", "Otávio", "Patrícia", "Rafael", "Sofia", "Thiago", "Úrsula", "Vinícius", "Yara", "Caio", "Beatriz", "Lucas", "Mariana", "Pedro", "Renata", "Tatiana", "Gustavo", "Helena", "Igor", "Júlia", "Kléber", "Letícia", "Murilo", "Nina", "Olívia", "Paulo", "Quézia", "Rodrigo", "Sara", "Tiago", "Valéria", "William", "Yasmin", "Camila", "Daniel", "Estela", "Fábio", "Glória"];
  const lastNames = ["Souza", "Lima", "Mendes", "Costa", "Almeida", "Pereira", "Rocha", "Carvalho", "Ribeiro", "Gomes", "Martins", "Araújo", "Barbosa", "Cardoso", "Dias", "Freitas", "Moraes", "Nunes", "Teixeira", "Vieira", "Campos", "Pinto", "Macedo", "Brito", "Cunha"];
  const freqs = ["semanal", "semanal", "semanal", "quinzenal"];
  const freqDays: Record<string, number> = { semanal: 7, quinzenal: 14, mensal: 30 };
  const queixas = ["Ansiedade generalizada", "Episódio depressivo", "Luto", "Terapia de casal", "Síndrome do pânico", "Estresse no trabalho (burnout)", "Autoestima", "TOC", "Fobia social", "Adaptação a mudanças", "Conflitos familiares", "Transtorno alimentar"];
  const tagPool = ["TCC", "ansiedade", "depressão", "casal", "luto", "adolescente", "online", "quinzenal", "pânico", "burnout", "psicanálise", "infantil"];

  type Pat = { id: string; name: string; fee: number; freq: string; status: string; startedAt: Date; contractType: string; sessionsInPacket: number | null; queixa: string; mode: string; location: string | null; behavior: string; paymentFormat: string; recurring: boolean };
  const activePats: Pat[] = [];
  const allPats: Pat[] = [];
  const patientRows: any[] = [];
  const statusHistRows: any[] = [];
  const priceHistRows: any[] = [];

  const statuses: string[] = [...Array(cfg.active).fill("ativo"), ...Array(cfg.paused).fill("pausado"), ...Array(cfg.inactive).fill("inativo")];
  const usedNames = new Set<string>();
  const uniqueName = () => {
    let n = `${pick(firstNames)} ${pick(lastNames)}`;
    let g = 0;
    while (usedNames.has(n) && g++ < 200) n = `${pick(firstNames)} ${pick(lastNames)}`;
    usedNames.add(n);
    return n;
  };

  for (let i = 0; i < statuses.length; i++) {
    const id = uuid();
    const status = statuses[i];
    const name = uniqueName();
    const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") + rnd(1, 99);
    const fee = pick([150, 160, 180, 200, 200, 220, 250, 280]);
    const freq = pick(freqs);
    const behavior = pick(["emdia", "emdia", "credito", "credito", "devedor", "devedor", "devedor", "pacote", "pacote_renovar", "pacote_renovar"]);
    const isPkg = behavior === "pacote" || behavior === "pacote_renovar";
    const contractType = isPkg ? "pacote" : "avulso";
    const sessionsInPacket = isPkg ? pick([2, 4, 8]) : null;
    const paymentFormat = isPkg ? "pacote" : pick(["avulso", "mensal", "quinzenal"]);
    const timesPerPeriod = freq === "semanal" ? pick([1, 1, 2]) : 1;
    const mode = pick(["online", "online", "presencial", "presencial", "presencial", "misto"]);
    const chosenLoc = mode === "online" ? null : locLabel(pick(LOCATIONS));
    const startedAt = new Date(start); startedAt.setMonth(startedAt.getMonth() + rnd(0, MONTHS - 2)); startedAt.setDate(rnd(1, 28));
    const queixa = pick(queixas);
    const nTags = rnd(1, 3);
    const tags = Array.from(new Set(Array.from({ length: nTags }, () => pick(tagPool)))).join(", ");
    const devedorAtivo = status === "ativo" && (behavior === "devedor" || behavior === "pacote_renovar");
    const overdue = devedorAtivo || (status === "ativo" && chance(0.1));

    // classificação + nascimento coerente + responsável (menores)
    const category = pick(["crianca", "adolescente", "adulto", "adulto", "adulto", "idoso", "casal"]);
    const ageRange: Record<string, [number, number]> = { crianca: [6, 11], adolescente: [12, 17], adulto: [20, 58], idoso: [61, 84], casal: [28, 50] };
    const [aMin, aMax] = ageRange[category];
    const birth = new Date(now); birth.setFullYear(birth.getFullYear() - rnd(aMin, aMax)); birth.setMonth(rnd(0, 11)); birth.setDate(rnd(1, 28));
    const isMinor = category === "crianca" || category === "adolescente";
    const cpf = `${rnd(100, 999)}.${rnd(100, 999)}.${rnd(100, 999)}-${rnd(10, 99)}`;
    const attDay = pick(WEEK_DAYS);
    const attTime = pick(["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]);

    let notes = queixa + (chance(0.4) ? ". " + pick(["Boa adesão.", "Encaminhado por colega.", "Uso de medicação acompanhada por psiquiatra.", "Histórico familiar relevante."]) : "");
    if (devedorAtivo) notes += " " + pick(DEBT_REASONS);

    patientRows.push({
      id, userId, name,
      email: `${slug}@email.com`,
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      sessionFee: money(fee), frequency: freq,
      patientStatus: status,
      paymentStatus: status === "inativo" ? "pending" : overdue ? "overdue" : "paid",
      contractType, sessionsInPacket, timesPerPeriod, paymentFormat,
      attendanceMode: mode, attendanceLocation: chosenLoc,
      attendanceDay: attDay, attendanceTime: attTime,
      category, cpf, birthDate: birth,
      guardianName: isMinor ? `${pick(firstNames)} ${pick(lastNames)}` : null,
      guardianCpf: isMinor ? `${rnd(100, 999)}.${rnd(100, 999)}.${rnd(100, 999)}-${rnd(10, 99)}` : null,
      guardianPhone: isMinor ? `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}` : null,
      guardianEmail: isMinor ? `resp.${slug}@email.com` : null,
      priceReviewDate: status === "ativo" && chance(0.4) ? (() => { const d = new Date(now); d.setMonth(d.getMonth() + rnd(-1, 5)); return d; })() : null,
      packageCreditsUsed: 0,
      paymentDay: pick([5, 10, 15, 20]),
      startedAt,
      address: chance(0.5) ? `Rua ${pick(lastNames)}, ${rnd(10, 999)} — São Paulo/SP` : null,
      emergencyName: chance(0.5) ? `${pick(firstNames)} ${pick(lastNames)}` : null,
      emergencyPhone: chance(0.5) ? `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}` : null,
      emergencyEmail: chance(0.3) ? `emerg.${slug}@email.com` : null,
      emergencyRelationship: chance(0.5) ? pick(["Cônjuge", "Mãe", "Pai", "Irmão(ã)", "Amigo(a)"]) : null,
      reminderEnabled: chance(0.7),
      reminderChannel: pick(["whatsapp", "whatsapp", "email", "telegram"]),
      reminderLeadMinutes: pick([30, 60, 60, 120, 1440]),
      tags,
      moodToken: token(),
      notes,
    });
    statusHistRows.push({ patientId: id, status, date: startedAt });
    priceHistRows.push({ patientId: id, valor: money(fee - 20), dataEfetiva: startedAt });
    if (chance(0.5)) {
      const bump = new Date(startedAt); bump.setMonth(bump.getMonth() + rnd(8, 16));
      if (bump < now) priceHistRows.push({ patientId: id, valor: money(fee), dataEfetiva: bump });
    }
    const p: Pat = { id, name, fee, freq, status, startedAt, contractType, sessionsInPacket, queixa, mode, location: chosenLoc, behavior, paymentFormat, recurring: status === "ativo" && chance(0.25) };
    allPats.push(p);
    if (status === "ativo") activePats.push(p);
  }

  const prospectSeeds: { id: string; fee: number; pd: Date }[] = [];
  for (let i = 0; i < cfg.prospects; i++) {
    const pid = uuid();
    const pd = new Date(now); pd.setDate(pd.getDate() - rnd(2, 120));
    const fee = pick([180, 200, 220]);
    patientRows.push({
      id: pid, userId, name: uniqueName(),
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      email: chance(0.6) ? `lead${i}@email.com` : null,
      patientStatus: "prospect", prospectDate: pd,
      prospectFechou: pick(["", "", "", "Não fechou"]),
      prospectObservacoes: pick(["Indicação de paciente.", "Veio pelo Instagram.", "Primeira conversa por telefone.", "Pediu valores e horários.", "Buscando terapia de casal."]),
      sessionFee: money(fee),
    });
    statusHistRows.push({ patientId: pid, status: "prospect", date: pd });
    prospectSeeds.push({ id: pid, fee, pd });
  }

  await chunkInsert(patients, patientRows);
  await chunkInsert(patientStatusHistory, statusHistRows);
  await chunkInsert(patientPriceHistory, priceHistRows);
  console.log(`🧑‍⚕️ ${patientRows.length} pacientes (${activePats.length} ativos + ${cfg.prospects} prospects).`);

  const sessionRows: any[] = [];
  const paymentRows: any[] = [];
  const txRows: any[] = [];
  const recordRows: any[] = [];
  const consumedByPatient: Record<string, number> = {};

  const evolucoes = [
    "Paciente relata melhora do sono. Trabalhamos reestruturação cognitiva de pensamentos catastróficos.",
    "Sessão focada em exposição gradual. Boa adesão às tarefas de casa.",
    "Explorada relação com figura parental. Emergiu material relevante para o vínculo.",
    "Treino de respiração diafragmática e relaxamento. Reduziu sintomas físicos de ansiedade.",
    "Revisão das metas terapêuticas. Paciente percebe avanços na assertividade.",
    "Discussão sobre limites no trabalho. Identificados gatilhos de estresse.",
    "Psicoeducação sobre o ciclo da ansiedade. Paciente engajado.",
    "Trabalho com diário de pensamentos. Identificadas distorções cognitivas frequentes.",
  ];

  for (const p of allPats) {
    const step = freqDays[p.freq] ?? 7;
    const hour = pick([8, 9, 10, 11, 14, 15, 16, 17, 18, 19]);
    const recUntil = new Date(now.getTime() + 120 * 86400000); // limite da recorrência
    const stop = p.status === "ativo" ? new Date(now.getTime() + (p.recurring ? 120 : 21) * 86400000) : new Date(now.getTime() - rnd(30, 300) * 86400000);
    const cur = new Date(p.startedAt); cur.setHours(hour, 0, 0, 0);

    while (cur <= stop) {
      const isPast = cur < now;
      let status: string;
      if (!isPast) status = "agendada";
      else { const r = Math.random(); status = r < 0.82 ? "realizada" : r < 0.88 ? "cancelada" : r < 0.94 ? "realocada" : "nao_realizada"; }
      const sid = uuid();
      const chargeable = status === "realizada" || status === "agendada";
      const isOnline = p.mode === "online" ? true : p.mode === "misto" ? chance(0.5) : false;
      const sessionLocation = isOnline ? null : (p.location || locLabel(pick(LOCATIONS)));
      const realizadaPast = status === "realizada";

      let meetingHappened = false, meetingOpenedAt: Date | null = null, guestJoinedAt: Date | null = null, meetingEndedAt: Date | null = null;
      if (isOnline && realizadaPast) {
        meetingHappened = true;
        meetingOpenedAt = new Date(cur); meetingOpenedAt.setMinutes(meetingOpenedAt.getMinutes() - rnd(1, 5));
        guestJoinedAt = new Date(cur); guestJoinedAt.setMinutes(guestJoinedAt.getMinutes() + rnd(0, 4));
        meetingEndedAt = new Date(cur); meetingEndedAt.setMinutes(meetingEndedAt.getMinutes() + rnd(45, 55));
      }

      const hasNote = realizadaPast && chance(0.45);
      sessionRows.push({
        id: sid, userId, patientId: p.id, date: new Date(cur), duration: 50, fee: money(p.fee), status,
        chargeable: status === "nao_realizada" ? false : chargeable, isOnline, location: sessionLocation,
        pendingConfirmation: !isPast && (p.recurring ? true : chance(0.35)), // futuras: reserva (recorrentes sempre reserva)
        recurring: !isPast && p.recurring,
        recurrenceUntil: (!isPast && p.recurring) ? recUntil : null,
        notes: hasNote ? pick(evolucoes) : null,
        justificativa: (status === "cancelada" || status === "realocada") ? pick(["Paciente remarcou.", "Imprevisto pessoal.", "Feriado.", "Atestado médico."]) : null,
        meetingHappened, meetingOpenedAt, guestJoinedAt, meetingEndedAt,
        patientSummary: realizadaPast && chance(0.25) ? "Combinamos praticar a técnica de respiração 2x ao dia e registrar os pensamentos no diário até nossa próxima conversa." : null,
      });
      if (hasNote) recordRows.push({ id: uuid(), userId, patientId: p.id, sessionId: sid, type: "evolucao", title: null, content: pick(evolucoes), createdAt: new Date(cur) });

      if (realizadaPast && chargeable) consumedByPatient[p.id] = (consumedByPatient[p.id] ?? 0) + p.fee;
      cur.setDate(cur.getDate() + step);
    }
    recordRows.push({ id: uuid(), userId, patientId: p.id, sessionId: null, type: "anamnese", title: "Anamnese inicial", content: `Queixa principal: ${p.queixa}. História: paciente buscou atendimento por demanda relacionada a ${p.queixa.toLowerCase()}. Sem internações prévias. Rede de apoio presente.`, createdAt: p.startedAt });
  }

  // Pagamentos → saldo-alvo por comportamento, com DÉBITO LIMITADO a no máx. 4 sessões.
  // balance = pago − cobrado; geramos pagamentos parcelados (com receita) até o alvo.
  for (const p of allPats) {
    if (p.status === "prospect") continue;
    const consumed = consumedByPatient[p.id] ?? 0;
    const fee = p.fee;
    let targetBalance = 0; // em R$
    if (p.status !== "ativo") targetBalance = 0; // pausados/inativos quitados
    else if (p.behavior === "credito") targetBalance = fee * rnd(1, 4);   // crédito ≤ 4 sessões
    else if (p.behavior === "emdia") targetBalance = chance(0.5) ? 0 : fee * rnd(0, 1);
    else if (p.behavior === "devedor") targetBalance = -fee * rnd(1, 4);  // dívida ≤ 4 sessões
    else if (p.behavior === "pacote") targetBalance = fee * rnd(0, 2);
    else if (p.behavior === "pacote_renovar") targetBalance = -fee * rnd(1, 4);
    let payTotal = consumed + targetBalance;
    if (payTotal < 0) payTotal = 0;
    if (payTotal <= 0) continue;
    // parcela em pagamentos mensais ao longo do período de atendimento
    const months = Math.max(1, Math.min(24, Math.round((now.getTime() - p.startedAt.getTime()) / (30 * 86400000))));
    const k = Math.max(1, Math.min(months, Math.round(payTotal / fee))) || 1;
    const per = payTotal / k;
    for (let i = 0; i < k; i++) {
      const d = new Date(p.startedAt); d.setMonth(d.getMonth() + Math.floor((i / k) * months) + 1); d.setDate(pick([5, 10, 15, 20]));
      if (d > now) d.setTime(now.getTime() - rnd(1, 25) * 86400000);
      const txId = uuid();
      const payMethod = pick(["pix", "pix", "pix", "card", "transfer", "cash"]);
      const txForm = payMethod === "card" ? "credito" : payMethod === "transfer" ? "transferencia" : payMethod === "cash" ? "dinheiro" : "pix";
      txRows.push({ id: txId, userId, accountId: contaPJ.id, amount: money(per), type: "income", categoryId: catSessions, description: `Pagamento — ${p.name}`, date: d, source: "session_payment", method: txForm });
      paymentRows.push({ userId, patientId: p.id, sessionId: null, amount: money(per), date: d, method: payMethod, status: "paid", linkedTransactionId: txId });
    }
  }

  // Pacotes numerados (P1, P2, ...) — sessões EM ABERTO no máx. 4 no total.
  const packageRows: any[] = [];
  for (const p of activePats) {
    if (p.behavior !== "pacote" && p.behavior !== "pacote_renovar") continue;
    const n = rnd(1, 3); // histórico de pacotes (anteriores esgotados)
    const openTarget = p.behavior === "pacote_renovar" ? rnd(0, 1) : rnd(1, 4); // restantes ≤ 4
    for (let seq = 1; seq <= n; seq++) {
      const isLast = seq === n;
      const sessions = pick([2, 4]);
      const used = isLast ? Math.max(0, sessions - Math.min(openTarget, sessions)) : sessions; // só o último tem saldo
      packageRows.push({ userId, patientId: p.id, seq, sessions, used: Math.min(used, sessions), fee: money(p.fee) });
    }
  }
  await chunkInsert(patientPackages, packageRows);

  const expMonth = new Date(start);
  while (expMonth <= now) {
    const mk = (cat: string, desc: string, val: number, day: number, type: "income" | "expense" = "expense") => {
      const d = new Date(expMonth); d.setDate(day);
      if (d <= now) txRows.push({ id: uuid(), userId, accountId: contaPJ.id, amount: money(val), type, categoryId: cat, description: desc, date: d, source: "manual", method: type === "income" ? pick(["pix", "transferencia", "deposito"]) : pick(["debito", "pix", "boleto", "credito", "transferencia"]) });
    };
    mk(catAluguel, "Aluguel da sala", 1200 + rnd(-50, 80), 5);
    mk(catSuper, "Supervisão clínica", 400, 12);
    mk(catMaterial, "Material de consultório", rnd(60, 220), 18);
    mk(catImpostos, "Impostos (DAS)", rnd(450, 750), 20);
    mk(catSoftware, "Assinaturas (Ledivan, etc.)", rnd(50, 120), 8);
    if (chance(0.5)) mk(catMkt, "Anúncios / Marketing", rnd(80, 250), 22);
    if (chance(0.25)) mk(catOutras, "Palestra / workshop", rnd(300, 900), rnd(10, 26), "income");
    expMonth.setMonth(expMonth.getMonth() + 1);
  }

  for (const ps of prospectSeeds) {
    if (!chance(0.5)) continue;
    const n = rnd(1, 2);
    for (let k = 0; k < n; k++) {
      const d = new Date(ps.pd); d.setDate(d.getDate() + k * 7 + rnd(0, 3)); d.setHours(pick([9, 10, 14, 15, 18]), 0, 0, 0);
      const past = d < now;
      sessionRows.push({ id: uuid(), userId, patientId: ps.id, date: d, duration: 50, fee: money(ps.fee), status: past ? "realizada" : "agendada", chargeable: past, isOnline: chance(0.5), location: null, notes: past ? "Sessão de avaliação inicial." : null, meetingHappened: false, meetingOpenedAt: null, guestJoinedAt: null, meetingEndedAt: null, patientSummary: null });
      if (past) recordRows.push({ id: uuid(), userId, patientId: ps.id, sessionId: null, type: "evolucao", title: "Avaliação", content: "Primeira escuta. Demanda mapeada; combinado seguir com acompanhamento.", createdAt: d });
    }
  }

  await chunkInsert(therapySessions, sessionRows);
  await chunkInsert(transactions, txRows);
  await chunkInsert(sessionPayments, paymentRows);
  await chunkInsert(patientRecords, recordRows);
  console.log(`🗓️ ${sessionRows.length} sessões · 💸 ${paymentRows.length} pagamentos · 📊 ${txRows.length} transações · 📋 ${recordRows.length} registros.`);

  const assignmentRows: any[] = [];
  const taskTemplates = [
    { t: "Diário de pensamentos", i: "Registre situações que geraram ansiedade, o pensamento automático e uma resposta alternativa.", rt: "texto" },
    { t: "Registro de humor diário", i: "Anote seu humor (1 a 5) ao acordar e antes de dormir.", rt: "texto" },
    { t: "Foto do espaço de relaxamento", i: "Monte um cantinho de calma e envie uma foto.", rt: "foto" },
    { t: "Áudio de gratidão", i: "Grave um áudio curto citando 3 coisas boas do seu dia.", rt: "audio" },
    { t: "Exposição gradual", i: "Liste situações temidas em ordem de dificuldade.", rt: "livre" },
  ];
  for (const p of activePats) {
    const n = rnd(1, 4);
    for (let i = 0; i < n; i++) {
      const tpl = pick(taskTemplates);
      const created = new Date(now); created.setDate(created.getDate() - rnd(5, 200));
      const responded = chance(0.6);
      assignmentRows.push({
        id: uuid(), userId, patientId: p.id, token: token(),
        title: tpl.t, instructions: tpl.i, responseType: tpl.rt,
        status: responded ? "respondida" : "pendente",
        dueDate: (() => { const d = new Date(created); d.setDate(d.getDate() + 7); return d; })(),
        responseText: responded ? pick(["Consegui fazer quase todos os dias, foi difícil no começo.", "Percebi que meus pensamentos eram exagerados.", "Foi bom registrar, me senti mais leve.", "Tive dificuldade num dia mais ansioso."]) : null,
        respondedAt: responded ? (() => { const d = new Date(created); d.setDate(d.getDate() + rnd(1, 6)); return d; })() : null,
        therapistComment: responded && chance(0.5) ? "Ótimo trabalho! Vamos conversar sobre isso na sessão." : null,
        createdAt: created,
      });
    }
  }
  await chunkInsert(assignments, assignmentRows);

  const moodRows: any[] = [];
  for (const p of activePats) {
    if (!chance(0.7)) continue;
    const low = chance(0.25);
    const days = rnd(8, 40);
    for (let d = 0; d < days; d++) {
      const when = new Date(now); when.setDate(when.getDate() - rnd(0, 90));
      const mood = low ? pick([1, 2, 2, 3]) : pick([3, 3, 4, 4, 5]);
      moodRows.push({ id: uuid(), userId, patientId: p.id, mood, note: chance(0.3) ? pick(["Dia puxado no trabalho.", "Dormi melhor.", "Discussão em casa.", "Consegui caminhar."]) : null, loggedAt: when });
    }
  }
  await chunkInsert(moodLogs, moodRows);

  const scaleRows: any[] = [];
  for (const p of activePats) {
    if (!chance(0.65)) continue;
    const type = pick(["phq9", "gad7"]);
    const max = type === "phq9" ? 27 : 21;
    const apps = rnd(1, 4);
    let base = rnd(Math.floor(max * 0.4), Math.floor(max * 0.8));
    for (let a = 0; a < apps; a++) {
      const when = new Date(now); when.setDate(when.getDate() - (apps - a) * rnd(20, 45));
      const score = Math.max(0, Math.min(max, base));
      const n = type === "phq9" ? 9 : 7;
      const answers = Array.from({ length: n }, () => 0);
      let rem = score;
      for (let q = 0; q < n && rem > 0; q++) { const v = Math.min(3, rnd(0, Math.min(3, rem))); answers[q] = v; rem -= v; }
      scaleRows.push({ id: uuid(), userId, patientId: p.id, token: token(), scaleType: type, status: "respondida", answers: JSON.stringify(answers), score, severity: type === "phq9" ? phqSeverity(score) : gadSeverity(score), appliedAt: when });
      base -= rnd(2, 5);
    }
  }
  await chunkInsert(scaleApplications, scaleRows);

  const goalRows: any[] = [];
  const goalTemplates = [
    ["Reduzir crises de ansiedade", "Diminuir frequência e intensidade das crises com técnicas de manejo."],
    ["Melhorar higiene do sono", "Estabelecer rotina e reduzir uso de telas à noite."],
    ["Aumentar assertividade", "Expressar necessidades e estabelecer limites saudáveis."],
    ["Retomar atividades prazerosas", "Reintroduzir hobbies e contato social."],
    ["Reestruturar pensamentos disfuncionais", "Identificar e questionar distorções cognitivas."],
  ];
  for (const p of activePats) {
    const n = rnd(1, 3);
    const used = new Set<number>();
    for (let i = 0; i < n; i++) {
      let idx = rnd(0, goalTemplates.length - 1);
      let g = 0; while (used.has(idx) && g++ < 10) idx = rnd(0, goalTemplates.length - 1);
      used.add(idx);
      const [title, description] = goalTemplates[idx];
      const progress = pick([0, 20, 30, 50, 60, 75, 100]);
      goalRows.push({ id: uuid(), userId, patientId: p.id, title, description, status: progress >= 100 ? "atingido" : pick(["ativo", "ativo", "pausado"]), progress, targetDate: (() => { const d = new Date(now); d.setMonth(d.getMonth() + rnd(1, 6)); return d; })(), createdAt: p.startedAt });
    }
  }
  await chunkInsert(treatmentGoals, goalRows);
  console.log(`🧩 ${assignmentRows.length} tarefas · 😊 ${moodRows.length} humores · 📈 ${scaleRows.length} escalas · 🎯 ${goalRows.length} objetivos.`);

  console.log(`\n✨ Pronto! ${EMAIL} populado com ~${MONTHS} meses de uso.`);
  return userId;
}

// Segunda camada do seed: as tabelas que o runSeed não cobre, para exercitar 100% das telas.
// Consentimento (LGPD), inbox de mensagens, diário do paciente, avaliações pós-sessão, materiais
// compartilhados, histórico de contrato, Receita Saúde (recibos), pagamentos em aberto,
// devolutivas aos responsáveis e cronômetro/sala de espera. Idempotente: limpa o que insere.
export async function seedExtras(userId: string) {
  console.log("➕ Extras (consentimento, mensagens, diário, avaliações, materiais, recibos)…");
  const now = new Date();

  // limpa os extras deste usuário (re-run limpo)
  const pats = await db.query.patients.findMany({ where: eq(patients.userId, userId) });
  const patIds = pats.map((p) => p.id);
  await db.delete(consentForms).where(eq(consentForms.userId, userId));
  await db.delete(patientConsents).where(eq(patientConsents.userId, userId));
  await db.delete(patientDiary).where(eq(patientDiary.userId, userId));
  await db.delete(sessionRatings).where(eq(sessionRatings.userId, userId));
  await db.delete(patientDocument).where(eq(patientDocument.userId, userId));
  await db.delete(messages).where(eq(messages.userId, userId));
  await db.delete(messageLog).where(eq(messageLog.userId, userId));
  if (patIds.length) await db.delete(patientContractHistory).where(inArray(patientContractHistory.patientId, patIds));

  // Termo de consentimento do terapeuta (um por terapeuta)
  const formUpdatedAt = new Date(now); formUpdatedAt.setMonth(formUpdatedAt.getMonth() - 20);
  await db.insert(consentForms).values({
    userId,
    title: "Termo de Consentimento Livre e Esclarecido — Psicoterapia",
    body: "Declaro estar ciente de que os atendimentos são confidenciais, que os registros clínicos são protegidos pelo sigilo profissional e pela LGPD, e autorizo o tratamento dos meus dados para fins exclusivos do acompanhamento terapêutico. Estou ciente da política de faltas e cancelamentos e do valor das sessões.",
    updatedAt: formUpdatedAt,
  });

  const active = pats.filter((p) => p.patientStatus === "ativo");
  const withHistory = pats.filter((p) => p.patientStatus !== "prospect");

  // Aceite do termo pelo paciente (snapshot) — ~80% dos pacientes com histórico
  const consentRows: any[] = [];
  for (const p of withHistory) {
    if (!chance(0.8)) continue;
    const when = new Date(p.startedAt ?? now); when.setDate((p.startedAt ?? now).getDate() + rnd(0, 5));
    consentRows.push({
      userId, patientId: p.id,
      title: "Termo de Consentimento Livre e Esclarecido — Psicoterapia",
      body: "Snapshot do termo aceito no primeiro acesso ao app do paciente.",
      acceptedName: p.guardianName || p.name,
      formUpdatedAt, ip: `189.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`,
      acceptedAt: when,
    });
  }
  await chunkInsert(patientConsents, consentRows);

  // Histórico de contrato (mudança de modelo/valor/pacote) — nos pacientes ativos
  const contractRows: any[] = [];
  for (const p of active) {
    if (!chance(0.4)) continue;
    const when = new Date(p.startedAt ?? now); when.setMonth((p.startedAt ?? now).getMonth() + rnd(3, 12));
    if (when >= now) continue;
    const opt = pick([
      { type: "frequency", from: "quinzenal", to: "semanal", description: "Aumentou a frequência para semanal." },
      { type: "contract_type", from: "avulso", to: "pacote", description: "Passou a contratar por pacote." },
      { type: "payment_day", from: "10", to: "5", description: "Alterou o dia de pagamento." },
    ]);
    contractRows.push({ patientId: p.id, ...opt, date: when });
  }
  await chunkInsert(patientContractHistory, contractRows);

  // Diário do paciente (entre sessões) — série curta nos ativos
  const diaryRows: any[] = [];
  for (const p of active) {
    if (!chance(0.5)) continue;
    const n = rnd(2, 8);
    for (let i = 0; i < n; i++) {
      const when = new Date(now); when.setDate(when.getDate() - rnd(1, 120));
      diaryRows.push({
        userId, patientId: p.id,
        content: pick([
          "Semana difícil, mas consegui usar a técnica de respiração antes da reunião.",
          "Briguei com meu irmão e percebi que reagi no automático. Quero conversar sobre isso.",
          "Dormi melhor depois que reduzi o café à noite.",
          "Tive um dia bom, saí para caminhar e me senti mais leve.",
          "A ansiedade voltou forte hoje, anotei os pensamentos como combinamos.",
        ]),
        mood: rnd(1, 5), createdAt: when,
      });
    }
  }
  await chunkInsert(patientDiary, diaryRows);

  // Materiais compartilhados (texto/link) — nos ativos
  const docRows: any[] = [];
  const materials = [
    { title: "Exercício de respiração diafragmática", kind: "text", content: "Inspire pelo nariz contando até 4, segure 4, expire pela boca contando 6. Repita por 5 minutos, 2x ao dia." },
    { title: "Vídeo: entendendo a ansiedade", kind: "link", content: "https://www.youtube.com/watch?v=exemplo" },
    { title: "Registro de pensamentos (modelo)", kind: "text", content: "Situação | Pensamento automático | Emoção (0-100) | Resposta alternativa | Emoção depois" },
    { title: "Higiene do sono — 10 dicas", kind: "text", content: "1. Horário regular. 2. Sem telas 1h antes. 3. Quarto escuro e fresco…" },
  ];
  for (const p of active) {
    if (!chance(0.55)) continue;
    const n = rnd(1, 3);
    for (let i = 0; i < n; i++) {
      const m = pick(materials);
      const when = new Date(now); when.setDate(when.getDate() - rnd(5, 200));
      docRows.push({ userId, patientId: p.id, title: m.title, kind: m.kind, content: m.content, createdAt: when });
    }
  }
  await chunkInsert(patientDocument, docRows);

  // Avaliações pós-sessão (1 por sessão realizada, amostrado)
  const realized = await db.query.therapySessions.findMany({
    where: and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada")),
    columns: { id: true, patientId: true, date: true }, orderBy: [desc(therapySessions.date)], limit: 400,
  });
  const ratingRows: any[] = [];
  const seenSession = new Set<string>();
  for (const s of realized) {
    if (seenSession.has(s.id) || !chance(0.35)) continue;
    seenSession.add(s.id);
    const score = pick([4, 5, 5, 5, 3, 4]);
    ratingRows.push({
      userId, patientId: s.patientId, sessionId: s.id, score,
      comment: chance(0.4) ? pick(["Me senti acolhido.", "Sessão muito produtiva.", "Saí mais leve.", "Ajudou bastante hoje."]) : null,
      createdAt: new Date(s.date),
    });
  }
  await chunkInsert(sessionRatings, ratingRows);

  // Cronômetro + sala de espera + confirmação — nas sessões realizadas recentes
  let timerPatched = 0;
  for (const s of realized.slice(0, 60)) {
    if (!chance(0.6)) continue;
    const start = new Date(s.date); start.setMinutes(start.getMinutes() - rnd(1, 8));
    const arrived = new Date(s.date); arrived.setMinutes(arrived.getMinutes() - rnd(2, 12));
    const end = new Date(s.date); end.setMinutes(end.getMinutes() + rnd(45, 55));
    const confirmed = new Date(s.date); confirmed.setHours(confirmed.getHours() - rnd(2, 30));
    await db.update(therapySessions).set({
      timerStartedAt: start, timerEndedAt: end, patientArrivedAt: arrived, patientConfirmedAt: confirmed,
    }).where(eq(therapySessions.id, s.id));
    timerPatched++;
  }

  // Devolutivas aos responsáveis (sessionKind) — pacientes menores (com responsável)
  const minors = withHistory.filter((p) => p.guardianName);
  const devoRows: any[] = [];
  for (const p of minors.slice(0, 12)) {
    const when = new Date(now); when.setDate(when.getDate() - rnd(10, 300)); when.setHours(pick([9, 14, 17]), 0, 0, 0);
    const past = when < now;
    devoRows.push({
      userId, patientId: p.id, date: when, duration: 50, fee: money(Number(p.sessionFee)),
      status: past ? "realizada" : "agendada", sessionKind: "devolutiva", chargeable: chance(0.5),
      isOnline: chance(0.4), notes: past ? "Devolutiva aos responsáveis: alinhamento do plano terapêutico e orientações de manejo em casa." : null,
    });
  }
  await chunkInsert(therapySessions, devoRows);

  // Receita Saúde: marca ~40% dos pagamentos pagos como recibo emitido
  const paid = await db.query.sessionPayments.findMany({
    where: and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid")),
    columns: { id: true, date: true }, limit: 500,
  });
  let receiptSeq = 1, receiptPatched = 0;
  for (const pay of paid) {
    if (!chance(0.4)) continue;
    const issued = new Date(pay.date); issued.setDate(issued.getDate() + rnd(0, 10));
    await db.update(sessionPayments).set({
      receiptNumber: `RS-${String(receiptSeq++).padStart(5, "0")}`, receiptIssuedAt: issued,
    }).where(eq(sessionPayments.id, pay.id));
    receiptPatched++;
  }

  // Pagamentos EM ABERTO (pending/overdue) — nos ativos devedores, exercita a coluna status
  const openPayRows: any[] = [];
  for (const p of active) {
    if (!chance(0.25)) continue;
    const overdue = chance(0.5);
    const d = new Date(now); d.setDate(d.getDate() - (overdue ? rnd(20, 60) : rnd(1, 10)));
    openPayRows.push({
      userId, patientId: p.id, sessionId: null, amount: money(Number(p.sessionFee)),
      date: d, method: pick(["pix", "transfer"]), status: overdue ? "overdue" : "pending",
    });
  }
  await chunkInsert(sessionPayments, openPayRows);

  // Inbox de mensagens (2-via) + log de envios
  const msgRows: any[] = [];
  const logRows: any[] = [];
  for (const p of active) {
    if (!chance(0.6)) continue;
    const base = new Date(now); base.setDate(base.getDate() - rnd(1, 40));
    const phone = p.phone || `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`;
    // lembrete enviado (out) + confirmação (in)
    const t1 = new Date(base);
    msgRows.push({ userId, patientId: p.id, direction: "out", channel: "whatsapp", contact: phone, text: `Olá, ${p.name.split(" ")[0]}! Lembrete da sua sessão. Podemos confirmar?`, createdAt: t1 });
    logRows.push({ userId, patientId: p.id, event: "session_reminder", channel: "whatsapp", destination: phone, status: "sent", createdAt: t1 });
    if (chance(0.7)) {
      const t2 = new Date(t1); t2.setHours(t2.getHours() + rnd(1, 6));
      msgRows.push({ userId, patientId: p.id, direction: "in", channel: "whatsapp", contact: phone, text: pick(["Confirmado! 🙏", "Pode ser sim.", "Consigo sim, obrigada.", "Preciso remarcar essa, pode ser?"]), createdAt: t2 });
    }
  }
  await chunkInsert(messages, msgRows);
  await chunkInsert(messageLog, logRows);

  // Status do dia: uma amostra de pacientes ATIVOS registra status (emoji+texto), alguns já
  // reagidos. Assim a feature aparece em vários pacientes do demo, não só na Dionísia.
  const EMO = [
    { e: "😰", m: 2, t: "Cheguei ansioso hoje." }, { e: "🙂", m: 4, t: "Dia tranquilo." },
    { e: "😴", m: 2, t: "Dormi mal." }, { e: "😢", m: 2, t: "Semana pesada." },
    { e: "😄", m: 5, t: "Tô bem hoje!" }, { e: "😐", m: 3, t: null }, { e: "💪", m: 4, t: "Enfrentei um medo." },
  ];
  const statusRows: any[] = [];
  const cadencePatch: string[] = [];
  for (const p of active.slice(0, 12)) {
    const n = rnd(2, 5);
    for (let i = 0; i < n; i++) {
      const s = pick(EMO);
      const when = new Date(now); when.setDate(when.getDate() - (i * 2 + rnd(0, 1))); when.setHours(pick([8, 9, 17, 18]), rnd(0, 59), 0, 0);
      const reacted = i > 0 && chance(0.5);
      statusRows.push({ userId, patientId: p.id, emoji: s.e, mood: s.m, text: s.t,
        reactionEmoji: reacted ? pick(["❤️", "🫂", "👍", "🌱"]) : null, reactionAt: reacted ? when : null, seenByTherapistAt: reacted ? when : null, createdAt: when });
    }
    if (chance(0.6)) cadencePatch.push(p.id);
  }
  await chunkInsert(patientDailyStatus, statusRows);
  if (cadencePatch.length) await db.update(patients).set({ statusReminderDays: pick([1, 2, 3, 7]) }).where(inArray(patients.id, cadencePatch));

  console.log(`   consentimentos:${consentRows.length} contrato:${contractRows.length} diário:${diaryRows.length} materiais:${docRows.length} avaliações:${ratingRows.length} timers:${timerPatched} devolutivas:${devoRows.length} recibos:${receiptPatched} em-aberto:${openPayRows.length} mensagens:${msgRows.length} status:${statusRows.length}`);
}

// E-mail/telefone fixos da PACIENTE de demonstração (Srta. Dionísia) — usados pelo login demo
// do paciente (/api/patient/demo) para encontrá-la sob a conta do terapeuta demo.
export const DEMO_PATIENT_EMAIL = "dionisia@demo.ledivan.com.br";
export const DEMO_PATIENT_PHONE = "(11) 98888-0001";

// Cria a PACIENTE de demonstração "Srta. Dionísia" — curada (não aleatória), ativa, com TODOS
// os recursos do paciente ligados e um histórico completo do "outro lado" (tarefas, humor,
// escalas, diário, materiais, metas, sessões passadas+futuras, pagamentos, consentimento,
// mensagens). É a modelo do app/portal do paciente. Idempotente: apaga a Dionísia anterior.
export async function seedDionisia(userId: string) {
  console.log("👩 Srta. Dionísia (paciente demo, 'outro lado')…");
  const now = new Date();

  // remove uma Dionísia anterior (re-run limpo) — cascata cobre sessões/tarefas/etc dela
  const prev = await db.query.patients.findFirst({
    where: and(eq(patients.userId, userId), eq(patients.email, DEMO_PATIENT_EMAIL)),
  });
  if (prev) await db.delete(patients).where(eq(patients.id, prev.id));

  const [{ maxNum }] = await db.select({ maxNum: sql<number>`coalesce(max(${patients.registrationNumber}), 0)` })
    .from(patients).where(eq(patients.userId, userId));

  const pid = uuid();
  const fee = 220;
  const startedAt = new Date(now); startedAt.setMonth(startedAt.getMonth() - 14); startedAt.setDate(8);
  const birth = new Date(now); birth.setFullYear(birth.getFullYear() - 29); birth.setMonth(4); birth.setDate(17);
  // todos os recursos do paciente ligados para esta paciente (belt-and-suspenders além das prefs)
  const overrides = { timer: true, waitingRoom: true, moodCheckin: true, scales: true, diary: true, goalsVisible: true, rescheduleApp: true, payment: true, rating: true, consent: true };

  await db.insert(patients).values({
    id: pid, userId,
    registrationNumber: Number(maxNum) + 1,
    name: "Srta. Dionísia Prado",
    email: DEMO_PATIENT_EMAIL,
    phone: DEMO_PATIENT_PHONE,
    sessionFee: money(fee), frequency: "semanal", timesPerPeriod: 1,
    patientStatus: "ativo", paymentStatus: "paid",
    contractType: "avulso", paymentFormat: "mensal",
    attendanceMode: "online", attendanceLocation: null,
    attendanceDay: "quarta", attendanceTime: "18:00",
    category: "adulto", cpf: "312.457.889-20", birthDate: birth,
    address: "Rua das Acácias, 245 — São Paulo/SP",
    emergencyName: "Helena Prado", emergencyPhone: "(11) 97777-0002", emergencyRelationship: "Mãe",
    reminderEnabled: true, reminderChannel: "whatsapp", reminderLeadMinutes: 120,
    priceReviewDate: (() => { const d = new Date(now); d.setMonth(d.getMonth() + 2); return d; })(),
    paymentDay: 10, startedAt,
    queixaPrincipal: "Ansiedade generalizada",
    tags: "TCC, ansiedade, online, demo",
    moodToken: token(),
    featureOverrides: JSON.stringify(overrides),
    notes: "Paciente-modelo da demonstração (app do paciente). Boa adesão às tarefas; usa o app com frequência.",
  });
  await db.insert(patientStatusHistory).values({ patientId: pid, status: "ativo", date: startedAt });
  await db.insert(patientPriceHistory).values([
    { patientId: pid, valor: money(fee - 30), dataEfetiva: startedAt },
    { patientId: pid, valor: money(fee), dataEfetiva: (() => { const d = new Date(startedAt); d.setMonth(d.getMonth() + 8); return d; })() },
  ]);

  // Sessões: semanais nos últimos ~14 meses (realizadas) + 3 futuras agendadas (próxima consulta).
  const sess: any[] = [];
  const recs: any[] = [];
  const ratings: any[] = [];
  const cur = new Date(startedAt); cur.setHours(18, 0, 0, 0);
  const evolucoes = [
    "Trabalhamos reestruturação cognitiva dos pensamentos catastróficos sobre o trabalho. Boa adesão.",
    "Treino de respiração e exposição gradual a situações sociais. Reduziu evitação.",
    "Revisão das metas: percebe avanço na assertividade com a família.",
    "Psicoeducação sobre o ciclo da ansiedade; combinamos registro no diário.",
  ];
  let firstRealizadaId: string | null = null;
  while (cur <= now) {
    const sid = uuid();
    const realizada = chance(0.85);
    const status = realizada ? "realizada" : pick(["cancelada", "realocada", "nao_realizada"]);
    const online = true;
    sess.push({
      id: sid, userId, patientId: pid, date: new Date(cur), duration: 50, fee: money(fee),
      status, chargeable: realizada, isOnline: online, sessionKind: "consulta",
      notes: realizada && chance(0.5) ? pick(evolucoes) : null,
      patientConfirmedAt: realizada ? (() => { const d = new Date(cur); d.setHours(d.getHours() - 3); return d; })() : null,
      patientArrivedAt: realizada && chance(0.6) ? (() => { const d = new Date(cur); d.setMinutes(d.getMinutes() - 4); return d; })() : null,
      meetingHappened: realizada, meetingOpenedAt: realizada ? new Date(cur) : null,
      patientSummary: realizada && chance(0.4) ? "Combinamos praticar a respiração 2x ao dia e registrar os pensamentos no diário até nossa próxima conversa." : null,
    });
    if (realizada) {
      if (!firstRealizadaId) firstRealizadaId = sid;
      if (chance(0.5)) recs.push({ id: uuid(), userId, patientId: pid, sessionId: sid, type: "evolucao", title: null, content: pick(evolucoes), createdAt: new Date(cur) });
      if (chance(0.4)) ratings.push({ userId, patientId: pid, sessionId: sid, score: pick([4, 5, 5]), comment: chance(0.5) ? pick(["Saí mais leve.", "Ajudou bastante.", "Muito acolhedor."]) : null, createdAt: new Date(cur) });
    }
    cur.setDate(cur.getDate() + 7);
  }
  // 3 sessões futuras agendadas (próxima consulta no app)
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i * 7); d.setHours(18, 0, 0, 0);
    sess.push({ id: uuid(), userId, patientId: pid, date: d, duration: 50, fee: money(fee), status: "agendada", chargeable: true, isOnline: true, sessionKind: "consulta", pendingConfirmation: i === 1 });
  }
  await chunkInsert(therapySessions, sess);
  recs.push({ id: uuid(), userId, patientId: pid, sessionId: null, type: "anamnese", title: "Anamnese inicial", content: "Queixa principal: ansiedade generalizada, com sintomas físicos (taquicardia, insônia) e preocupação excessiva com o trabalho. Sem internações. Rede de apoio: mãe e amigos próximos. Iniciou TCC.", createdAt: startedAt });
  await chunkInsert(patientRecords, recs);
  await chunkInsert(sessionRatings, ratings);

  // Pagamentos: mensais pagos + 1 em aberto (tela de pagamento do app)
  const pays: any[] = [];
  for (let m = 12; m >= 1; m--) {
    const d = new Date(now); d.setMonth(d.getMonth() - m); d.setDate(10);
    if (d < startedAt) continue;
    pays.push({ userId, patientId: pid, sessionId: null, amount: money(fee * 4), date: d, method: pick(["pix", "pix", "transfer"]), status: "paid", receiptNumber: chance(0.6) ? `RS-D${String(m).padStart(4, "0")}` : null, receiptIssuedAt: chance(0.6) ? d : null });
  }
  pays.push({ userId, patientId: pid, sessionId: null, amount: money(fee * 2), date: new Date(now), method: "pix", status: "pending" });
  await chunkInsert(sessionPayments, pays);

  // Tarefas (lição de casa): respondidas + pendentes, tipos variados
  const tasks = [
    { t: "Diário de pensamentos", i: "Registre situações que geraram ansiedade, o pensamento automático e uma resposta alternativa.", rt: "texto", resp: "Anotei 4 situações. Percebi que quase sempre eu superestimo o risco.", done: true },
    { t: "Registro de humor diário", i: "Anote seu humor (1 a 5) ao acordar e antes de dormir.", rt: "texto", resp: "Fiz por 6 dias seguidos, ficou mais fácil perceber os padrões.", done: true },
    { t: "Exposição gradual", i: "Liste situações temidas em ordem de dificuldade e enfrente a primeira.", rt: "livre", resp: null, done: false },
    { t: "Áudio de gratidão", i: "Grave um áudio curto citando 3 coisas boas do seu dia.", rt: "audio", resp: null, done: false },
  ];
  const taskRows = tasks.map((tk, i) => {
    const created = new Date(now); created.setDate(created.getDate() - (i + 1) * 6);
    return {
      id: uuid(), userId, patientId: pid, token: token(), title: tk.t, instructions: tk.i, responseType: tk.rt,
      status: tk.done ? "respondida" : "pendente",
      dueDate: (() => { const d = new Date(created); d.setDate(d.getDate() + 7); return d; })(),
      responseText: tk.resp,
      respondedAt: tk.done ? (() => { const d = new Date(created); d.setDate(d.getDate() + 2); return d; })() : null,
      therapistComment: tk.done && i === 0 ? "Ótimo! Vamos explorar esses registros na sessão." : null,
      createdAt: created,
    };
  });
  await chunkInsert(assignments, taskRows);

  // Humor: série de ~45 dias (check-ins pré/pós + livres)
  const moods: any[] = [];
  for (let d = 45; d >= 0; d--) {
    if (!chance(0.7)) continue;
    const when = new Date(now); when.setDate(when.getDate() - d);
    moods.push({ id: uuid(), userId, patientId: pid, mood: pick([2, 3, 3, 4, 4, 5]), note: chance(0.3) ? pick(["Dia puxado no trabalho.", "Dormi melhor.", "Consegui usar a respiração.", "Ansiedade mais baixa hoje."]) : null, context: pick(["free", "free", "pre", "post"]), loggedAt: when });
  }
  await chunkInsert(moodLogs, moods);

  // Escalas PHQ-9 e GAD-7 ao longo do tempo (melhora)
  const scales: any[] = [];
  const mk = (type: string, score: number, monthsAgo: number) => {
    const max = type === "phq9" ? 27 : 21; const n = type === "phq9" ? 9 : 7;
    const answers = Array.from({ length: n }, () => 0); let rem = Math.max(0, Math.min(max, score));
    for (let q = 0; q < n && rem > 0; q++) { const v = Math.min(3, rem); answers[q] = v; rem -= v; }
    const when = new Date(now); when.setMonth(when.getMonth() - monthsAgo);
    scales.push({ id: uuid(), userId, patientId: pid, token: token(), scaleType: type, status: "respondida", answers: JSON.stringify(answers), score, severity: type === "phq9" ? phqSeverity(score) : gadSeverity(score), appliedAt: when });
  };
  mk("phq9", 16, 6); mk("phq9", 11, 3); mk("phq9", 7, 0);
  mk("gad7", 14, 6); mk("gad7", 9, 2);
  await chunkInsert(scaleApplications, scales);

  // Diário entre sessões
  const diary = [
    "Semana difícil, mas usei a respiração antes da reunião e deu certo.",
    "Briguei com minha mãe e percebi que reagi no automático. Quero falar disso na sessão.",
    "Dormi melhor depois que reduzi o café à noite.",
    "Tive um dia bom, saí para caminhar e me senti mais leve.",
  ].map((c, i) => { const d = new Date(now); d.setDate(d.getDate() - (i + 1) * 5); return { id: uuid(), userId, patientId: pid, content: c, mood: pick([2, 3, 4, 4]), createdAt: d }; });
  await chunkInsert(patientDiary, diary);

  // Materiais compartilhados pelo terapeuta
  const docs = [
    { title: "Exercício de respiração diafragmática", kind: "text", content: "Inspire pelo nariz contando até 4, segure 4, expire pela boca contando 6. Repita por 5 minutos, 2x ao dia." },
    { title: "Vídeo: entendendo a ansiedade", kind: "link", content: "https://www.youtube.com/watch?v=exemplo" },
    { title: "Higiene do sono — 10 dicas", kind: "text", content: "1. Horário regular. 2. Sem telas 1h antes. 3. Quarto escuro e fresco. 4. Evitar cafeína após as 16h…" },
  ].map((m, i) => { const d = new Date(now); d.setDate(d.getDate() - (i + 2) * 10); return { userId, patientId: pid, title: m.title, kind: m.kind, content: m.content, createdAt: d }; });
  await chunkInsert(patientDocument, docs);

  // Metas terapêuticas visíveis ao paciente
  await chunkInsert(treatmentGoals, [
    { id: uuid(), userId, patientId: pid, title: "Reduzir crises de ansiedade", description: "Diminuir frequência e intensidade com técnicas de manejo.", status: "ativo", progress: 60, targetDate: (() => { const d = new Date(now); d.setMonth(d.getMonth() + 3); return d; })(), createdAt: startedAt },
    { id: uuid(), userId, patientId: pid, title: "Melhorar higiene do sono", description: "Rotina regular e menos telas à noite.", status: "ativo", progress: 40, targetDate: (() => { const d = new Date(now); d.setMonth(d.getMonth() + 2); return d; })(), createdAt: startedAt },
    { id: uuid(), userId, patientId: pid, title: "Aumentar assertividade", description: "Expressar necessidades e estabelecer limites.", status: "atingido", progress: 100, targetDate: now, createdAt: startedAt },
  ]);

  // Consentimento aceito
  const formUpdatedAt = new Date(startedAt);
  await chunkInsert(patientConsents, [{
    userId, patientId: pid,
    title: "Termo de Consentimento Livre e Esclarecido — Psicoterapia",
    body: "Snapshot do termo aceito no primeiro acesso ao app.",
    acceptedName: "Srta. Dionísia Prado", formUpdatedAt, ip: "189.10.20.30",
    acceptedAt: (() => { const d = new Date(startedAt); d.setDate(d.getDate() + 1); return d; })(),
  }]);

  // Inbox 2-via
  const t1 = new Date(now); t1.setDate(t1.getDate() - 2);
  const t2 = new Date(t1); t2.setHours(t2.getHours() + 3);
  await chunkInsert(messages, [
    { userId, patientId: pid, direction: "out", channel: "whatsapp", contact: DEMO_PATIENT_PHONE, text: "Olá, Dionísia! Lembrete da sua sessão de quarta às 18h. Podemos confirmar?", createdAt: t1 },
    { userId, patientId: pid, direction: "in", channel: "whatsapp", contact: DEMO_PATIENT_PHONE, text: "Confirmado! Obrigada 🙏", createdAt: t2 },
  ]);

  // Status do dia: série com emoji + texto + a curva de humor, algumas já reagidas pelo terapeuta.
  // Cadência de lembrete a cada 2 dias. (A demo é read-only: a Dionísia não posta, mas o histórico
  // aparece e o Dr. Sócrates vê/consulta.)
  await db.update(patients).set({ statusReminderDays: 2 }).where(eq(patients.id, pid));
  const STATUS = [
    { e: "😰", m: 2, t: "Cheguei ansiosa, tive uma reunião difícil hoje.", react: "🫂" },
    { e: "😴", m: 2, t: "Dormi mal essa semana.", react: "❤️" },
    { e: "🙂", m: 4, t: "Dia tranquilo, consegui usar a respiração.", react: "👍" },
    { e: "😢", m: 2, t: "Briga em casa, tô pra baixo.", react: "🫂" },
    { e: "😄", m: 5, t: "Semana boa! Saí com amigos.", react: null },
    { e: "😐", m: 3, t: null, react: null },
    { e: "💪", m: 4, t: "Enfrentei uma situação que evitava.", react: "🌱" },
  ];
  const statusRows = STATUS.map((s, i) => {
    const when = new Date(now); when.setDate(when.getDate() - (i * 2 + 1)); when.setHours(pick([8, 9, 17, 18]), rnd(0, 59), 0, 0);
    const reacted = !!s.react;
    return {
      userId, patientId: pid, emoji: s.e, mood: s.m, text: s.t,
      reactionEmoji: s.react, reactionText: reacted && i === 0 ? "Estou aqui com você. Vamos falar disso hoje." : null,
      reactionAt: reacted ? (() => { const d = new Date(when); d.setHours(d.getHours() + 1); return d; })() : null,
      seenByTherapistAt: reacted ? when : null,
      createdAt: when,
    };
  });
  await chunkInsert(patientDailyStatus, statusRows);

  // Escrita terapêutica: uma compartilhada com o terapeuta e uma privada (só dela).
  const w1 = new Date(now); w1.setDate(w1.getDate() - 4);
  const w2 = new Date(now); w2.setDate(w2.getDate() - 12);
  await chunkInsert(patientWriting, [
    { userId, patientId: pid, promptKey: "gratidao", promptTitle: "Três coisas boas", shared: true, sharedAt: w1, createdAt: w1,
      content: "Hoje consegui: 1) acordar sem apertar a soneca mil vezes; 2) uma conversa boa com minha mãe, sem briga; 3) 20 minutos de caminhada no fim da tarde. Faz diferença reparar nisso." },
    { userId, patientId: pid, promptKey: "expressiva", promptTitle: "Coloque para fora", shared: false, sharedAt: null, createdAt: w2,
      content: "Escrevi sobre a reunião que me deixou travada. Ainda não quero mostrar, mas ajudou botar no papel." },
  ]);

  console.log(`   Dionísia: ${sess.length} sessões · ${pays.length} pagamentos · ${taskRows.length} tarefas · ${moods.length} humores · ${scales.length} escalas · ${diary.length} diário · ${statusRows.length} status · 2 escritas · metas 3.`);
  return pid;
}
