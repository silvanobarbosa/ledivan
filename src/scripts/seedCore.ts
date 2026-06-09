// Núcleo de seed reutilizável (apoiador e silvano). Popula dados ricos:
// pacientes variados, sessões (online c/ tracking), pagamentos, créditos de pacote,
// prontuário, tarefas, humor, escalas, plano, financeiro, metas, conquistas, posts.
// Idempotente: limpa os dados de domínio do usuário e recria.
import { db } from "../db";
import {
  users, categories, financialAccounts, transactions, goals, achievements,
  patients, patientStatusHistory, patientPriceHistory, therapySessions, sessionPayments,
  patientRecords, assignments, scaleApplications, moodLogs, treatmentGoals, socialPosts, patientPackages,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";
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
  await db.delete(socialPosts).where(eq(socialPosts.userId, uid));
  await db.delete(therapySessions).where(eq(therapySessions.userId, uid));
  await db.delete(patients).where(eq(patients.userId, uid));
  await db.delete(transactions).where(eq(transactions.userId, uid));
  await db.delete(goals).where(eq(goals.userId, uid));
  await db.delete(achievements).where(eq(achievements.userId, uid));
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

  await db.insert(goals).values([
    { userId, title: "Reserva de emergência", targetAmount: "30000.00", currentAmount: money(rnd(18000, 27000)), createdAt: start },
    { userId, title: "Curso de especialização", targetAmount: "8000.00", currentAmount: money(rnd(3000, 7000)) },
    { userId, title: "Equipamento novo (consultório)", targetAmount: "5000.00", currentAmount: money(rnd(1000, 4800)) },
  ]);

  const ach = (type: string, title: string, description: string, monthsAgo: number) => {
    const d = new Date(now); d.setMonth(d.getMonth() - monthsAgo);
    return { userId, type, title, description, earnedAt: d };
  };
  await db.insert(achievements).values([
    ach("first_transaction", "Primeiro Passo", "Você registrou sua primeira transação no Ledivan!", MONTHS - 1),
    ach("ten_patients", "Consultório Cheio", "10 pacientes ativos!", Math.max(1, MONTHS - 6)),
    ach("goal_met", "Mestre do Planejamento", "Você atingiu uma meta!", 10),
    ach("streak", "Constância", "3 meses seguidos com lançamentos em dia.", 5),
    ach("financial_guru", "Guru Financeiro", "Gestão e metas em dia.", 2),
  ]);

  await db.insert(socialPosts).values([
    { userId, theme: "Ansiedade", network: "instagram", tone: "acolhedor", content: "Respirar é o primeiro passo. 🌿 A ansiedade fala alto, mas você pode aprender a ouvir o que ela tenta proteger. Terapia ajuda nesse caminho.", hashtags: "#ansiedade #saudemental #terapia #autocuidado" },
    { userId, theme: "Autocuidado", network: "instagram", tone: "inspirador", content: "Cuidar de si não é egoísmo, é base. Reserve hoje 10 minutos só seus. 💜", hashtags: "#autocuidado #bemestar #psicologia" },
    { userId, theme: "Terapia online", network: "linkedin", tone: "profissional", content: "Atendimento psicológico online: mesma escuta qualificada, com a flexibilidade que a sua rotina pede.", hashtags: "#terapiaonline #psicologia #saudemental" },
  ]);

  console.log(`\n✨ Pronto! ${EMAIL} populado com ~${MONTHS} meses de uso.`);
}
