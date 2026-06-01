// Seed de dados mock realistas (~15 meses) para a conta silvanobarbosa@gmail.com.
// Idempotente: limpa os dados de dominio do usuario e recria. NAO apaga o usuario/auth.
// Rodar: npm run seed:silvano
import { db } from "../db";
import {
  users, categories, financialAccounts, transactions, goals, achievements,
  patients, patientStatusHistory, patientPriceHistory, therapySessions, sessionPayments,
} from "../db/schema";
import { eq, inArray } from "drizzle-orm";

const EMAIL = "silvanobarbosa@gmail.com";
const NAME = "Silvano Barbosa";

const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rnd(0, arr.length - 1)];
const money = (n: number) => n.toFixed(2);
const uuid = () => crypto.randomUUID();

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

async function seed() {
  console.log("🌱 Seed Silvano — 15 meses de dados mock...");

  // 1. Usuario (cria se nao existir; mantem se ja existe p/ nao quebrar auth)
  let user = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!user) {
    [user] = await db.insert(users).values({ name: NAME, email: EMAIL }).returning();
    console.log(`👤 Usuario criado: ${user.id}`);
  } else {
    console.log(`👤 Usuario existente: ${user.id} — limpando dados de dominio...`);
    const pats = await db.query.patients.findMany({ where: eq(patients.userId, user.id) });
    const patIds = pats.map((p) => p.id);
    if (patIds.length) {
      await db.delete(patientStatusHistory).where(inArray(patientStatusHistory.patientId, patIds));
      await db.delete(patientPriceHistory).where(inArray(patientPriceHistory.patientId, patIds));
    }
    await db.delete(sessionPayments).where(eq(sessionPayments.userId, user.id));
    await db.delete(therapySessions).where(eq(therapySessions.userId, user.id));
    await db.delete(patients).where(eq(patients.userId, user.id));
    await db.delete(transactions).where(eq(transactions.userId, user.id));
    await db.delete(goals).where(eq(goals.userId, user.id));
    await db.delete(achievements).where(eq(achievements.userId, user.id));
    await db.delete(financialAccounts).where(eq(financialAccounts.userId, user.id));
    await db.update(users).set({ name: NAME }).where(eq(users.id, user.id));
  }
  const userId = user.id;

  // 2. Categorias
  const catSessions = await ensureCategory("Sessões", "income", "HeartHandshake", "#8b5cf6");
  const catAluguel = await ensureCategory("Aluguel sala", "expense", "Building2", "#b45309");
  const catSuper = await ensureCategory("Supervisão", "expense", "GraduationCap", "#6b5b6f");
  const catMaterial = await ensureCategory("Material", "expense", "Package", "#0ea5e9");
  const catImpostos = await ensureCategory("Impostos", "expense", "Landmark", "#b91c1c");
  const catMkt = await ensureCategory("Marketing", "expense", "Megaphone", "#16a34a");

  // 3. Contas financeiras
  const [contaPJ] = await db.insert(financialAccounts).values({
    userId, name: "Conta PJ", type: "checking", balance: "0", color: "#2b1830",
  }).returning();
  await db.insert(financialAccounts).values({ userId, name: "Carteira", type: "cash", balance: "0", color: "#8b5cf6" });
  await db.insert(financialAccounts).values({ userId, name: "Poupança", type: "savings", balance: "0", color: "#047857" });

  // Datas: 15 meses atras -> hoje
  const now = new Date();
  const start = new Date(now); start.setMonth(start.getMonth() - 15); start.setDate(1);

  // 4. Pacientes
  const firstNames = ["Ana", "Bruno", "Carla", "Diego", "Eliane", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Marcelo", "Natália", "Otávio", "Patrícia", "Rafael", "Sofia", "Thiago", "Úrsula", "Vinícius", "Yara", "Caio", "Beatriz", "Lucas", "Mariana", "Pedro", "Renata", "Tatiana", "Gustavo", "Helena", "Igor", "Júlia", "Kléber", "Letícia", "Murilo", "Nina"];
  const lastNames = ["Souza", "Lima", "Mendes", "Costa", "Almeida", "Pereira", "Rocha", "Carvalho", "Ribeiro", "Gomes", "Martins", "Araújo", "Barbosa", "Cardoso", "Dias", "Freitas", "Moraes", "Nunes", "Teixeira", "Vieira"];
  const freqs = ["semanal", "semanal", "semanal", "quinzenal"];
  const freqDays: Record<string, number> = { semanal: 7, quinzenal: 14, mensal: 30 };

  type Pat = { id: string; name: string; fee: number; freq: string; status: string; startedAt: Date; chargeable: boolean };
  const activePats: Pat[] = [];
  const patientRows: any[] = [];
  const statusHistRows: any[] = [];
  const priceHistRows: any[] = [];

  // Carga 3x: 27 ativos, 3 pausados, 6 inativos
  const statuses: string[] = [
    ...Array(27).fill("ativo"),
    ...Array(3).fill("pausado"),
    ...Array(6).fill("inativo"),
  ];
  const usedNames = new Set<string>();
  const uniqueName = () => {
    let n = `${pick(firstNames)} ${pick(lastNames)}`;
    let guard = 0;
    while (usedNames.has(n) && guard++ < 50) n = `${pick(firstNames)} ${pick(lastNames)}`;
    usedNames.add(n);
    return n;
  };
  for (let i = 0; i < statuses.length; i++) {
    const id = uuid();
    const status = statuses[i];
    const name = uniqueName();
    const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
    const fee = pick([150, 160, 180, 200, 220, 250]);
    const freq = pick(freqs);
    // entrou entre 15 e 2 meses atras
    const startedAt = new Date(start); startedAt.setMonth(startedAt.getMonth() + rnd(0, 13)); startedAt.setDate(rnd(1, 28));
    patientRows.push({
      id, userId, name,
      email: `${slug}@email.com`,
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      sessionFee: money(fee), frequency: freq,
      patientStatus: status,
      paymentStatus: status === "inativo" ? "pending" : "paid",
      contractType: pick(["avulso", "pacote"]),
      paymentDay: pick([5, 10, 15, 20]),
      startedAt,
      notes: pick(["", "Ansiedade.", "Acompanhamento de luto.", "Terapia de casal.", "TCC em andamento."]),
    });
    statusHistRows.push({ patientId: id, status, date: startedAt });
    // historico de preco: alguns tiveram reajuste
    priceHistRows.push({ patientId: id, valor: money(fee - 20), dataEfetiva: startedAt });
    if (Math.random() < 0.5) {
      const bump = new Date(startedAt); bump.setMonth(bump.getMonth() + 8);
      if (bump < now) priceHistRows.push({ patientId: id, valor: money(fee), dataEfetiva: bump });
    }
    if (status === "ativo") {
      activePats.push({ id, name, fee, freq, status, startedAt, chargeable: true });
    }
  }

  // 9 prospects (entradas recentes)
  for (let i = 0; i < 9; i++) {
    const pd = new Date(now); pd.setDate(pd.getDate() - rnd(2, 90));
    patientRows.push({
      id: uuid(), userId, name: uniqueName(),
      phone: `(11) 9${rnd(1000, 9999)}-${rnd(1000, 9999)}`,
      patientStatus: "prospect", prospectDate: pd,
      prospectFechou: pick(["", "", "Não fechou"]),
      prospectObservacoes: pick(["Indicação.", "Veio pelo Instagram.", "Primeira conversa por telefone."]),
      sessionFee: money(pick([180, 200])),
    });
  }

  await chunkInsert(patients, patientRows);
  await chunkInsert(patientStatusHistory, statusHistRows);
  await chunkInsert(patientPriceHistory, priceHistRows);
  console.log(`🧑‍⚕️ ${patientRows.length} pacientes (${activePats.length} ativos + 9 prospects).`);

  // 5. Sessoes + pagamentos + transacoes de receita
  const sessionRows: any[] = [];
  const paymentRows: any[] = [];
  const txRows: any[] = [];

  for (const p of activePats) {
    const step = freqDays[p.freq] ?? 7;
    const hour = pick([8, 9, 10, 14, 15, 16, 17, 18]);
    const cur = new Date(p.startedAt); cur.setHours(hour, 0, 0, 0);
    while (cur <= new Date(now.getTime() + 14 * 86400000)) {
      const isPast = cur < now;
      let status: string;
      if (!isPast) status = "agendada";
      else {
        const r = Math.random();
        status = r < 0.85 ? "realizada" : r < 0.9 ? "cancelada" : r < 0.95 ? "realocada" : "nao_realizada";
      }
      const sid = uuid();
      const chargeable = status !== "nao_realizada";
      sessionRows.push({
        id: sid, userId, patientId: p.id, date: new Date(cur),
        duration: 50, fee: money(p.fee), status, chargeable,
        notes: status === "realizada" && Math.random() < 0.3 ? pick(["Boa evolução.", "Trabalhamos crenças.", "Paciente trouxe avanço."]) : null,
        justificativa: status === "cancelada" || status === "realocada" ? pick(["Paciente remarcou.", "Imprevisto.", "Feriado."]) : null,
      });
      // pagamento + receita p/ sessoes realizadas e cobraveis
      if (status === "realizada" && chargeable) {
        const txId = uuid();
        const payDate = new Date(cur);
        txRows.push({
          id: txId, userId, accountId: contaPJ.id, amount: money(p.fee), type: "income",
          categoryId: catSessions, description: `Sessão — ${p.name}`, date: payDate, source: "session_payment",
        });
        paymentRows.push({
          userId, patientId: p.id, sessionId: sid, amount: money(p.fee), date: payDate,
          method: pick(["pix", "pix", "pix", "card", "transfer", "cash"]), status: "paid", linkedTransactionId: txId,
        });
      }
      cur.setDate(cur.getDate() + step);
    }
  }

  // 6. Despesas mensais recorrentes (15 meses)
  const expMonth = new Date(start);
  while (expMonth <= now) {
    const mk = (cat: string, desc: string, val: number, day: number) => {
      const d = new Date(expMonth); d.setDate(day);
      if (d <= now) txRows.push({ id: uuid(), userId, accountId: contaPJ.id, amount: money(val), type: "expense", categoryId: cat, description: desc, date: d, source: "manual" });
    };
    mk(catAluguel, "Aluguel da sala", 1200 + rnd(-50, 50), 5);
    mk(catSuper, "Supervisão clínica", 400, 12);
    mk(catMaterial, "Material de consultório", rnd(60, 220), 18);
    mk(catImpostos, "Impostos (DAS)", rnd(450, 700), 20);
    if (Math.random() < 0.5) mk(catMkt, "Anúncios / Marketing", rnd(80, 200), 22);
    expMonth.setMonth(expMonth.getMonth() + 1);
  }

  await chunkInsert(therapySessions, sessionRows);
  await chunkInsert(transactions, txRows);
  await chunkInsert(sessionPayments, paymentRows);
  console.log(`🗓️ ${sessionRows.length} sessões · 💸 ${paymentRows.length} pagamentos · 📊 ${txRows.length} transações.`);

  // 7. Metas
  await db.insert(goals).values([
    { userId, title: "Reserva de emergência", targetAmount: "20000.00", currentAmount: money(rnd(11000, 15000)), createdAt: start },
    { userId, title: "Curso de especialização", targetAmount: "6000.00", currentAmount: money(rnd(2000, 4500)) },
  ]);

  // 8. Conquistas (ganhas ao longo do tempo)
  const ach = (type: string, title: string, description: string, monthsAgo: number) => {
    const d = new Date(now); d.setMonth(d.getMonth() - monthsAgo);
    return { userId, type, title, description, earnedAt: d };
  };
  await db.insert(achievements).values([
    ach("first_transaction", "Primeiro Passo", "Você registrou sua primeira transação no Ledivan+!", 15),
    ach("goal_met", "Mestre do Planejamento", "Você atingiu uma meta!", 6),
    ach("financial_guru", "Guru Financeiro", "Você está dominando o Ledivan+! Meta e conquistas em dia.", 3),
  ]);

  console.log("🏆 Metas e conquistas criadas.");
  console.log(`\n✨ Pronto! Conta ${EMAIL} populada com ~15 meses de uso.`);
  process.exit(0);
}

seed().catch((e) => { console.error("❌", e); process.exit(1); });
