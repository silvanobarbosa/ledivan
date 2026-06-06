// Conta DEMO "apoiador@ledivan.com.br" — ~30 meses de uso, dados ricos em TODOS
// os recursos: pacientes variados, sessões (online c/ tracking), pagamentos,
// pacotes c/ créditos, prontuário, tarefas, humor, escalas, plano terapêutico,
// financeiro completo, metas, conquistas, posts. Login por senha.
// Idempotente: limpa os dados de domínio do usuário e recria.
// Rodar: npm run seed:apoiador
import { db } from "../db";
import {
  users, categories, financialAccounts, transactions, goals, achievements,
  patients, patientStatusHistory, patientPriceHistory, therapySessions, sessionPayments,
  patientRecords, assignments, scaleApplications, moodLogs, treatmentGoals, socialPosts,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

const EMAIL = "apoiador@ledivan.com.br";
const NAME = "Dra. Helena Moraes";
const PASSWORD = "ledivan12345";
const MONTHS = 30;

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

// PHQ-9 / GAD-7: severidade a partir do score
function phqSeverity(s: number) {
  return s >= 20 ? "grave" : s >= 15 ? "moderadamente grave" : s >= 10 ? "moderada" : s >= 5 ? "leve" : "mínima";
}
function gadSeverity(s: number) {
  return s >= 15 ? "grave" : s >= 10 ? "moderada" : s >= 5 ? "leve" : "mínima";
}

// Endereços presenciais do terapeuta (analíticos por local)
const LOCATIONS = [
  { name: "Consultório Centro", address: "Av. Paulista, 1000 — sala 52, São Paulo/SP" },
  { name: "Clínica Jardins", address: "Rua Oscar Freire, 200 — São Paulo/SP" },
  { name: "Espaço Pinheiros", address: "Rua dos Pinheiros, 850 — São Paulo/SP" },
];
const locLabel = (l: { name: string; address: string }) => `${l.name} — ${l.address}`;

async function seed() {
  console.log(`🌱 Seed Apoiador — ${MONTHS} meses de dados ricos...`);

  // 1. Usuário (cria/atualiza; define senha)
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let user = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!user) {
    [user] = await db.insert(users).values({ name: NAME, email: EMAIL, passwordHash, emailVerified: new Date(), bookingSlug: "helena-moraes", attendanceLocations: JSON.stringify(LOCATIONS) }).returning();
    console.log(`👤 Usuário criado: ${user.id}`);
  } else {
    console.log(`👤 Usuário existente: ${user.id} — limpando domínio...`);
    const pats = await db.query.patients.findMany({ where: eq(patients.userId, user.id) });
    const patIds = pats.map((p) => p.id);
    if (patIds.length) {
      await db.delete(patientStatusHistory).where(inArray(patientStatusHistory.patientId, patIds));
      await db.delete(patientPriceHistory).where(inArray(patientPriceHistory.patientId, patIds));
    }
    await db.delete(sessionPayments).where(eq(sessionPayments.userId, user.id));
    await db.delete(patientRecords).where(eq(patientRecords.userId, user.id));
    await db.delete(assignments).where(eq(assignments.userId, user.id));
    await db.delete(scaleApplications).where(eq(scaleApplications.userId, user.id));
    await db.delete(moodLogs).where(eq(moodLogs.userId, user.id));
    await db.delete(treatmentGoals).where(eq(treatmentGoals.userId, user.id));
    await db.delete(socialPosts).where(eq(socialPosts.userId, user.id));
    await db.delete(therapySessions).where(eq(therapySessions.userId, user.id));
    await db.delete(patients).where(eq(patients.userId, user.id));
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(goals).where(eq(goals.userId, user.id));
    await db.delete(achievements).where(eq(achievements.userId, user.id));
    await db.delete(financialAccounts).where(eq(financialAccounts.userId, user.id));
    await db.update(users).set({ name: NAME, passwordHash, emailVerified: new Date(), bookingSlug: "helena-moraes", attendanceLocations: JSON.stringify(LOCATIONS) }).where(eq(users.id, user.id));
  }
  const userId = user.id;

  // 2. Categorias
  const catSessions = await ensureCategory("Sessões", "income", "HeartHandshake", "#8b5cf6");
  const catOutras = await ensureCategory("Outras receitas", "income", "PlusCircle", "#16a34a");
  const catAluguel = await ensureCategory("Aluguel sala", "expense", "Building2", "#b45309");
  const catSuper = await ensureCategory("Supervisão", "expense", "GraduationCap", "#6b5b6f");
  const catMaterial = await ensureCategory("Material", "expense", "Package", "#0ea5e9");
  const catImpostos = await ensureCategory("Impostos", "expense", "Landmark", "#b91c1c");
  const catMkt = await ensureCategory("Marketing", "expense", "Megaphone", "#16a34a");
  const catSoftware = await ensureCategory("Software/Assinaturas", "expense", "Laptop", "#8b5cf6");

  // 3. Contas financeiras
  const [contaPJ] = await db.insert(financialAccounts).values({ userId, name: "Conta PJ", type: "checking", balance: "0", color: "#2b1830" }).returning();
  await db.insert(financialAccounts).values({ userId, name: "Carteira", type: "cash", balance: "0", color: "#8b5cf6" });
  await db.insert(financialAccounts).values({ userId, name: "Poupança", type: "savings", balance: "0", color: "#047857" });

  const now = new Date();
  const start = new Date(now); start.setMonth(start.getMonth() - MONTHS); start.setDate(1);

  // 4. Pacientes
  const firstNames = ["Ana", "Bruno", "Carla", "Diego", "Eliane", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcelo", "Natália", "Otávio", "Patrícia", "Rafael", "Sofia", "Thiago", "Úrsula", "Vinícius", "Yara", "Caio", "Beatriz", "Lucas", "Mariana", "Pedro", "Renata", "Tatiana", "Gustavo", "Helena", "Igor", "Júlia", "Kléber", "Letícia", "Murilo", "Nina", "Olívia", "Paulo", "Quézia", "Rodrigo"];
  const lastNames = ["Souza", "Lima", "Mendes", "Costa", "Almeida", "Pereira", "Rocha", "Carvalho", "Ribeiro", "Gomes", "Martins", "Araújo", "Barbosa", "Cardoso", "Dias", "Freitas", "Moraes", "Nunes", "Teixeira", "Vieira"];
  const freqs = ["semanal", "semanal", "semanal", "quinzenal"];
  const freqDays: Record<string, number> = { semanal: 7, quinzenal: 14, mensal: 30 };
  const queixas = ["Ansiedade generalizada", "Episódio depressivo", "Luto", "Terapia de casal", "Síndrome do pânico", "Estresse no trabalho (burnout)", "Autoestima", "TOC", "Fobia social", "Adaptação a mudanças"];
  const tagPool = ["TCC", "ansiedade", "depressão", "casal", "luto", "adolescente", "online", "quinzenal", "pânico", "burnout"];

  type Pat = { id: string; name: string; fee: number; freq: string; status: string; startedAt: Date; contractType: string; sessionsInPacket: number | null; queixa: string; mode: string; location: string | null };
  const activePats: Pat[] = [];
  const allPats: Pat[] = [];
  const patientRows: any[] = [];
  const statusHistRows: any[] = [];
  const priceHistRows: any[] = [];

  // 30 ativos, 4 pausados, 8 inativos
  const statuses: string[] = [...Array(30).fill("ativo"), ...Array(4).fill("pausado"), ...Array(8).fill("inativo")];
  const usedNames = new Set<string>();
  const uniqueName = () => {
    let n = `${pick(firstNames)} ${pick(lastNames)}`;
    let g = 0;
    while (usedNames.has(n) && g++ < 80) n = `${pick(firstNames)} ${pick(lastNames)}`;
    usedNames.add(n);
    return n;
  };

  for (let i = 0; i < statuses.length; i++) {
    const id = uuid();
    const status = statuses[i];
    const name = uniqueName();
    const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const fee = pick([150, 160, 180, 200, 200, 220, 250, 280]);
    const freq = pick(freqs);
    const contractType = pick(["avulso", "avulso", "pacote"]);
    const sessionsInPacket = contractType === "pacote" ? pick([4, 8, 10, 12]) : null;
    const mode = pick(["online", "online", "presencial", "presencial", "presencial", "misto"]); // ~ 33% online, 50% presencial, 17% misto
    const chosenLoc = mode === "online" ? null : locLabel(pick(LOCATIONS));
    const startedAt = new Date(start); startedAt.setMonth(startedAt.getMonth() + rnd(0, MONTHS - 2)); startedAt.setDate(rnd(1, 28));
    const queixa = pick(queixas);
    const nTags = rnd(1, 3);
    const tags = Array.from(new Set(Array.from({ length: nTags }, () => pick(tagPool)))).join(", ");
    // pagamento: a maioria em dia; alguns ativos atrasados (gera alerta clínico)
    const overdue = status === "ativo" && chance(0.18);

    patientRows.push({
      id, userId, name,
      email: `${slug}@email.com`,
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      sessionFee: money(fee), frequency: freq,
      patientStatus: status,
      paymentStatus: status === "inativo" ? "pending" : overdue ? "overdue" : "paid",
      contractType, sessionsInPacket,
      attendanceMode: mode,
      attendanceLocation: chosenLoc,
      packageCreditsUsed: 0,
      paymentDay: pick([5, 10, 15, 20]),
      startedAt,
      address: chance(0.5) ? `Rua ${pick(lastNames)}, ${rnd(10, 999)} — São Paulo/SP` : null,
      emergencyName: chance(0.4) ? `${pick(firstNames)} ${pick(lastNames)}` : null,
      emergencyPhone: chance(0.4) ? `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}` : null,
      emergencyRelationship: chance(0.4) ? pick(["Cônjuge", "Mãe", "Pai", "Irmão(ã)", "Amigo(a)"]) : null,
      reminderEnabled: chance(0.7),
      reminderChannel: pick(["whatsapp", "whatsapp", "email", "telegram"]),
      reminderLeadMinutes: pick([30, 60, 60, 120, 1440]),
      tags,
      moodToken: token(),
      notes: queixa + (chance(0.4) ? ". " + pick(["Boa adesão.", "Encaminhado por colega.", "Uso de medicação acompanhada por psiquiatra.", "Histórico familiar relevante."]) : ""),
    });
    statusHistRows.push({ patientId: id, status, date: startedAt });
    priceHistRows.push({ patientId: id, valor: money(fee - 20), dataEfetiva: startedAt });
    if (chance(0.5)) {
      const bump = new Date(startedAt); bump.setMonth(bump.getMonth() + rnd(8, 16));
      if (bump < now) priceHistRows.push({ patientId: id, valor: money(fee), dataEfetiva: bump });
    }
    const p: Pat = { id, name, fee, freq, status, startedAt, contractType, sessionsInPacket, queixa, mode, location: chosenLoc };
    allPats.push(p);
    if (status === "ativo") activePats.push(p);
  }

  // 12 prospects
  for (let i = 0; i < 12; i++) {
    const pd = new Date(now); pd.setDate(pd.getDate() - rnd(2, 120));
    patientRows.push({
      id: uuid(), userId, name: uniqueName(),
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      email: chance(0.6) ? `lead${i}@email.com` : null,
      patientStatus: "prospect", prospectDate: pd,
      prospectFechou: pick(["", "", "", "Não fechou"]),
      prospectObservacoes: pick(["Indicação de paciente.", "Veio pelo Instagram.", "Primeira conversa por telefone.", "Pediu valores e horários.", "Buscando terapia de casal."]),
      sessionFee: money(pick([180, 200, 220])),
    });
  }

  await chunkInsert(patients, patientRows);
  await chunkInsert(patientStatusHistory, statusHistRows);
  await chunkInsert(patientPriceHistory, priceHistRows);
  console.log(`🧑‍⚕️ ${patientRows.length} pacientes (${activePats.length} ativos + 12 prospects).`);

  // 5. Sessões + pagamentos + receita + prontuário + tracking online
  const sessionRows: any[] = [];
  const paymentRows: any[] = [];
  const txRows: any[] = [];
  const recordRows: any[] = [];
  const creditsUsedByPatient: Record<string, number> = {};

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
    if (p.status === "prospect") continue;
    const step = freqDays[p.freq] ?? 7;
    const hour = pick([8, 9, 10, 11, 14, 15, 16, 17, 18, 19]);
    // pausados/inativos param em algum momento no passado
    const stop = p.status === "ativo"
      ? new Date(now.getTime() + 21 * 86400000)
      : new Date(now.getTime() - rnd(30, 300) * 86400000);
    const cur = new Date(p.startedAt); cur.setHours(hour, 0, 0, 0);

    while (cur <= stop) {
      const isPast = cur < now;
      let status: string;
      if (!isPast) status = "agendada";
      else {
        const r = Math.random();
        status = r < 0.82 ? "realizada" : r < 0.88 ? "cancelada" : r < 0.94 ? "realocada" : "nao_realizada";
      }
      const sid = uuid();
      const chargeable = status === "realizada" || (status === "agendada");
      // online conforme o modo do paciente (misto alterna ~50/50)
      const isOnline = p.mode === "online" ? true : p.mode === "misto" ? chance(0.5) : false;
      const sessionLocation = isOnline ? null : (p.location || locLabel(pick(LOCATIONS)));
      const realizadaPast = status === "realizada";

      // tracking de reunião p/ online realizadas
      let meetingHappened = false, meetingOpenedAt: Date | null = null, guestJoinedAt: Date | null = null, meetingEndedAt: Date | null = null;
      if (isOnline && realizadaPast) {
        meetingHappened = true;
        meetingOpenedAt = new Date(cur); meetingOpenedAt.setMinutes(meetingOpenedAt.getMinutes() - rnd(1, 5));
        guestJoinedAt = new Date(cur); guestJoinedAt.setMinutes(guestJoinedAt.getMinutes() + rnd(0, 4));
        meetingEndedAt = new Date(cur); meetingEndedAt.setMinutes(meetingEndedAt.getMinutes() + rnd(45, 55));
      }

      const hasNote = realizadaPast && chance(0.45);
      sessionRows.push({
        id: sid, userId, patientId: p.id, date: new Date(cur), duration: 50,
        fee: money(p.fee), status,
        chargeable: status === "nao_realizada" ? false : chargeable,
        isOnline,
        location: sessionLocation,
        notes: hasNote ? pick(evolucoes) : null,
        justificativa: (status === "cancelada" || status === "realocada") ? pick(["Paciente remarcou.", "Imprevisto pessoal.", "Feriado.", "Atestado médico."]) : null,
        meetingHappened, meetingOpenedAt, guestJoinedAt, meetingEndedAt,
        patientSummary: realizadaPast && chance(0.25) ? "Combinamos praticar a técnica de respiração 2x ao dia e registrar os pensamentos no diário até nossa próxima conversa." : null,
      });

      // prontuário: evolução vinculada à sessão
      if (hasNote) {
        recordRows.push({ id: uuid(), userId, patientId: p.id, sessionId: sid, type: "evolucao", title: null, content: pick(evolucoes), createdAt: new Date(cur) });
      }

      // pagamento p/ realizadas cobráveis
      if (realizadaPast && chargeable) {
        const payDate = new Date(cur);
        // pacote: desconta crédito (limitado ao tamanho); avulso: gera receita avulsa
        if (p.contractType === "pacote" && p.sessionsInPacket) {
          const used = (creditsUsedByPatient[p.id] ?? 0);
          if (used < p.sessionsInPacket) creditsUsedByPatient[p.id] = used + 1;
        }
        const txId = uuid();
        txRows.push({ id: txId, userId, accountId: contaPJ.id, amount: money(p.fee), type: "income", categoryId: catSessions, description: `Sessão — ${p.name}`, date: payDate, source: "session_payment" });
        paymentRows.push({ userId, patientId: p.id, sessionId: sid, amount: money(p.fee), date: payDate, method: pick(["pix", "pix", "pix", "card", "transfer", "cash"]), status: "paid", linkedTransactionId: txId });
      }
      cur.setDate(cur.getDate() + step);
    }

    // anamnese inicial p/ todos atendidos
    recordRows.push({ id: uuid(), userId, patientId: p.id, sessionId: null, type: "anamnese", title: "Anamnese inicial", content: `Queixa principal: ${p.queixa}. História: paciente buscou atendimento por demanda relacionada a ${p.queixa.toLowerCase()}. Sem internações prévias. Rede de apoio presente.`, createdAt: p.startedAt });
  }

  // grava créditos usados nos pacientes
  for (const [pid, used] of Object.entries(creditsUsedByPatient)) {
    await db.update(patients).set({ packageCreditsUsed: used }).where(eq(patients.id, pid));
  }

  // 6. Despesas mensais recorrentes (30 meses) + algumas receitas avulsas
  const expMonth = new Date(start);
  while (expMonth <= now) {
    const mk = (cat: string, desc: string, val: number, day: number, type: "income" | "expense" = "expense") => {
      const d = new Date(expMonth); d.setDate(day);
      if (d <= now) txRows.push({ id: uuid(), userId, accountId: contaPJ.id, amount: money(val), type, categoryId: cat, description: desc, date: d, source: "manual" });
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

  await chunkInsert(therapySessions, sessionRows);
  await chunkInsert(transactions, txRows);
  await chunkInsert(sessionPayments, paymentRows);
  await chunkInsert(patientRecords, recordRows);
  console.log(`🗓️ ${sessionRows.length} sessões · 💸 ${paymentRows.length} pagamentos · 📊 ${txRows.length} transações · 📋 ${recordRows.length} registros.`);

  // 7. Tarefas (lição de casa) — algumas respondidas
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

  // 8. Diário de humor — vários registros; alguns pacientes com humor baixo (alerta)
  const moodRows: any[] = [];
  for (const p of activePats) {
    if (!chance(0.7)) continue;
    const low = chance(0.25); // ~25% em fase difícil
    const days = rnd(8, 40);
    for (let d = 0; d < days; d++) {
      const when = new Date(now); when.setDate(when.getDate() - rnd(0, 90));
      const mood = low ? pick([1, 2, 2, 3]) : pick([3, 3, 4, 4, 5]);
      moodRows.push({ id: uuid(), userId, patientId: p.id, mood, note: chance(0.3) ? pick(["Dia puxado no trabalho.", "Dormi melhor.", "Discussão em casa.", "Consegui caminhar."]) : null, loggedAt: when });
    }
  }
  await chunkInsert(moodLogs, moodRows);

  // 9. Escalas PHQ-9 / GAD-7 — várias aplicações, evolução; algumas em alerta
  const scaleRows: any[] = [];
  for (const p of activePats) {
    if (!chance(0.65)) continue;
    const type = pick(["phq9", "gad7"]);
    const max = type === "phq9" ? 27 : 21;
    const apps = rnd(1, 4);
    let base = rnd(Math.floor(max * 0.4), Math.floor(max * 0.8)); // começa moderado/grave
    for (let a = 0; a < apps; a++) {
      const when = new Date(now); when.setDate(when.getDate() - (apps - a) * rnd(20, 45));
      const score = Math.max(0, Math.min(max, base));
      const n = type === "phq9" ? 9 : 7;
      const answers = Array.from({ length: n }, () => 0);
      let rem = score;
      for (let q = 0; q < n && rem > 0; q++) { const v = Math.min(3, rnd(0, Math.min(3, rem))); answers[q] = v; rem -= v; }
      scaleRows.push({ id: uuid(), userId, patientId: p.id, token: token(), scaleType: type, status: "respondida", answers: JSON.stringify(answers), score, severity: type === "phq9" ? phqSeverity(score) : gadSeverity(score), appliedAt: when });
      base -= rnd(2, 5); // tende a melhorar
    }
  }
  await chunkInsert(scaleApplications, scaleRows);

  // 10. Plano terapêutico (objetivos) por paciente ativo
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

  // 11. Metas financeiras (poupança)
  await db.insert(goals).values([
    { userId, title: "Reserva de emergência", targetAmount: "30000.00", currentAmount: money(rnd(18000, 27000)), createdAt: start },
    { userId, title: "Curso de especialização", targetAmount: "8000.00", currentAmount: money(rnd(3000, 7000)) },
    { userId, title: "Equipamento novo (consultório)", targetAmount: "5000.00", currentAmount: money(rnd(1000, 4800)) },
  ]);

  // 12. Conquistas
  const ach = (type: string, title: string, description: string, monthsAgo: number) => {
    const d = new Date(now); d.setMonth(d.getMonth() - monthsAgo);
    return { userId, type, title, description, earnedAt: d };
  };
  await db.insert(achievements).values([
    ach("first_transaction", "Primeiro Passo", "Você registrou sua primeira transação no Ledivan!", MONTHS - 1),
    ach("ten_patients", "Consultório Cheio", "10 pacientes ativos!", MONTHS - 6),
    ach("goal_met", "Mestre do Planejamento", "Você atingiu uma meta!", 10),
    ach("streak", "Constância", "3 meses seguidos com lançamentos em dia.", 5),
    ach("financial_guru", "Guru Financeiro", "Gestão e metas em dia.", 2),
  ]);

  // 13. Posts de divulgação
  await db.insert(socialPosts).values([
    { userId, theme: "Ansiedade", network: "instagram", tone: "acolhedor", content: "Respirar é o primeiro passo. 🌿 A ansiedade fala alto, mas você pode aprender a ouvir o que ela tenta proteger. Terapia ajuda nesse caminho.", hashtags: "#ansiedade #saudemental #terapia #autocuidado" },
    { userId, theme: "Autocuidado", network: "instagram", tone: "inspirador", content: "Cuidar de si não é egoísmo, é base. Reserve hoje 10 minutos só seus. 💜", hashtags: "#autocuidado #bemestar #psicologia" },
    { userId, theme: "Terapia online", network: "linkedin", tone: "profissional", content: "Atendimento psicológico online: mesma escuta qualificada, com a flexibilidade que a sua rotina pede.", hashtags: "#terapiaonline #psicologia #saudemental" },
  ]);

  console.log("🏆 Metas, conquistas e posts criados.");
  console.log(`\n✨ Pronto! Conta DEMO ${EMAIL} (senha: ${PASSWORD}) populada com ~${MONTHS} meses de uso.`);
  process.exit(0);
}

seed().catch((e) => { console.error("❌", e); process.exit(1); });
