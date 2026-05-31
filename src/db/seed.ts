// src/db/seed.mts
import { db } from "./index";
import * as schema from "./schema";

const { users, categories, transactions, goals, financialAccounts, patients, therapySessions, sessionPayments } = schema;

async function seed() {
  console.log("🌱 Iniciando o semeio do banco de dados...");

  // 1. Criar Usuário Principal (ID fixo para facilitar teste)
  const [user] = await db.insert(users).values({
    id: "user_test_123",
    name: "Dra. Helena Moraes",
    email: "helena@ledivan.app",
  }).onConflictDoNothing().returning();

  const userId = user?.id || "user_test_123";
  console.log(`👤 Usuário: ${userId}`);

  // 2. Criar Contas Financeiras
  const [nubank] = await db.insert(financialAccounts).values({
    userId,
    name: "Nubank",
    type: "checking",
    balance: "12450.00",
    color: "#8A05BE",
  }).returning();

  const [carteira] = await db.insert(financialAccounts).values({
    userId,
    name: "Carteira",
    type: "cash",
    balance: "150.00",
    color: "#4CAF50",
  }).returning();

  console.log("💳 Contas criadas.");

  // 3. Criar Categorias Padrão
  const defaultCategories = [
    { name: "Alimentação", type: "expense" as const, icon: "ShoppingCart", color: "#FF5252" },
    { name: "Transporte", type: "expense" as const, icon: "Car", color: "#448AFF" },
    { name: "Lazer", type: "expense" as const, icon: "Gamepad2", color: "#E040FB" },
    { name: "Saúde", type: "expense" as const, icon: "HeartPulse", color: "#66BB6A" },
    { name: "Salário", type: "income" as const, icon: "Banknote", color: "#43A047" },
    { name: "Investimentos", type: "income" as const, icon: "TrendingUp", color: "#00E676" },
    { name: "Sessões", type: "income" as const, icon: "HeartHandshake", color: "#8b5cf6" },
    { name: "Aluguel sala", type: "expense" as const, icon: "Building2", color: "#b45309" },
  ];

  await db.insert(categories).values(defaultCategories).onConflictDoNothing();
  const allCategories = await db.query.categories.findMany();
  console.log(`📂 Categorias criadas: ${allCategories.length}`);

  // 4. Criar Transações Iniciais
  await db.insert(transactions).values([
    {
      userId,
      accountId: nubank.id,
      amount: "5200.00",
      type: "income",
      description: "Salário Mensal",
      categoryId: allCategories.find(c => c.name === "Salário")?.id,
      source: "manual",
    },
    {
      userId,
      accountId: carteira.id,
      amount: "150.00",
      type: "expense",
      description: "Supermercado Extra",
      categoryId: allCategories.find(c => c.name === "Alimentação")?.id,
      source: "manual",
    }
  ]);

  console.log("💰 Transações criadas.");

  // 5. Criar Metas
  await db.insert(goals).values({
    userId,
    title: "Reserva de Emergência",
    targetAmount: "10000.00",
    currentAmount: "6500.00",
  });

  console.log("🎯 Meta inicial criada.");

  // 6. Criar Pacientes (dominio Terapia)
  const [ana] = await db.insert(patients).values({
    userId,
    name: "Ana Souza",
    phone: "(11) 98888-1111",
    email: "ana@example.com",
    sessionFee: "180.00",
    frequency: "semanal",
    patientStatus: "ativo",
    paymentStatus: "paid",
    contractType: "avulso",
    paymentDay: 5,
    startedAt: new Date(),
  }).returning();

  const [bruno] = await db.insert(patients).values({
    userId,
    name: "Bruno Lima",
    phone: "(11) 97777-2222",
    sessionFee: "200.00",
    frequency: "quinzenal",
    patientStatus: "ativo",
    paymentStatus: "pending",
    contractType: "pacote",
    sessionsInPacket: 4,
    startedAt: new Date(),
  }).returning();

  // prospect
  await db.insert(patients).values({
    userId,
    name: "Carla Mendes",
    phone: "(11) 96666-3333",
    patientStatus: "prospect",
    prospectDate: new Date(),
    prospectFechou: "",
    sessionFee: "180.00",
  });

  console.log("🧑‍⚕️ Pacientes criados.");

  // 7. Criar Sessões
  const now = new Date();
  const sessionCat = allCategories.find((c) => c.name === "Sessões");
  await db.insert(therapySessions).values([
    { userId, patientId: ana.id, date: new Date(now.getTime() + 86400000), duration: 50, fee: "180.00", status: "agendada" },
    { userId, patientId: ana.id, date: new Date(now.getTime() - 6 * 86400000), duration: 50, fee: "180.00", status: "realizada" },
    { userId, patientId: bruno.id, date: new Date(now.getTime() + 2 * 86400000), duration: 50, fee: "200.00", status: "agendada" },
  ]);

  console.log("🗓️ Sessões criadas.");

  // 8. Pagamento vinculado ao financeiro (gera transacao de receita)
  const [tx] = await db.insert(transactions).values({
    userId,
    accountId: nubank.id,
    amount: "180.00",
    type: "income",
    categoryId: sessionCat?.id,
    description: "Sessão — Ana Souza",
    source: "session_payment",
  }).returning();

  await db.insert(sessionPayments).values({
    userId,
    patientId: ana.id,
    amount: "180.00",
    method: "pix",
    status: "paid",
    linkedTransactionId: tx.id,
  });

  console.log("💸 Pagamento de sessão vinculado ao financeiro.");

  console.log("\n✨ Semeio concluído com sucesso!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro no semeio:", err);
  process.exit(1);
});
