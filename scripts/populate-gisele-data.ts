import "dotenv/config";
import { db } from "@/db";
import {
  users,
  patients,
  therapySessions,
  sessionPayments,
  financialAccounts,
  categories,
  transactions
} from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Script para popular dados de exemplo para Gisele Barroso Santos
 * Cria pacientes, sessões, pagamentos e dados financeiros de exemplo
 */

const GISELE_EMAIL = "giselebarrossantos@gmail.com";

async function populateGiseleData() {
  console.log("🔍 Buscando usuário da Gisele...");

  // Busca o usuário
  const user = await db.query.users.findFirst({
    where: eq(users.email, GISELE_EMAIL)
  });

  if (!user) {
    console.error("❌ Usuário não encontrado! Execute primeiro: npm run create-gisele");
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Usuário encontrado: ${user.name} (${userId})`);

  // Verifica se já tem dados
  const existingPatients = await db.query.patients.findMany({
    where: eq(patients.userId, userId)
  });

  if (existingPatients.length > 0) {
    console.log("⚠️  Usuário já possui dados. Para resetar, delete manualmente primeiro.");
    console.log(`   Pacientes existentes: ${existingPatients.length}`);
    return;
  }

  console.log("\n📝 Criando dados de exemplo...\n");

  // 1. Criar categorias financeiras
  console.log("💰 Criando categorias financeiras...");
  const categoriesData = [
    { name: "Sessões", icon: "🧠", color: "#8B5CF6", type: "income" as const },
    { name: "Aluguel Consultório", icon: "🏢", color: "#EF4444", type: "expense" as const },
    { name: "Material Escritório", icon: "📝", color: "#F59E0B", type: "expense" as const },
    { name: "Formação", icon: "📚", color: "#3B82F6", type: "expense" as const },
    { name: "Outros", icon: "📌", color: "#6B7280", type: "both" as const }
  ];

  for (const cat of categoriesData) {
    await db.insert(categories).values({
      ...cat,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoNothing();
  }

  // 2. Criar conta financeira
  console.log("🏦 Criando conta bancária...");
  const [account] = await db.insert(financialAccounts).values({
    name: "Conta Consultório",
    balance: 15000, // Saldo inicial
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  // 3. Criar pacientes de exemplo
  console.log("👥 Criando pacientes...");
  const patientsData = [
    {
      name: "Ana Silva",
      email: "ana.silva@example.com",
      phone: "(11) 98765-4321",
      sessionFee: 180,
      frequency: "Semanal",
      status: "active" as const,
      paymentDay: 5,
      contractType: "avulso" as const,
      notes: "Atendimento às segundas 14h"
    },
    {
      name: "Carlos Mendes",
      email: "carlos.mendes@example.com",
      phone: "(11) 97654-3210",
      sessionFee: 200,
      frequency: "Quinzenal",
      status: "active" as const,
      paymentDay: 10,
      contractType: "pacote" as const,
      sessionsInPacket: 4,
      notes: "Preferência por horário noturno"
    },
    {
      name: "Maria Oliveira",
      email: "maria.oliveira@example.com",
      phone: "(11) 96543-2109",
      sessionFee: 180,
      frequency: "Semanal",
      status: "active" as const,
      paymentDay: 15,
      contractType: "avulso" as const,
      notes: "Atendimento online via Google Meet"
    },
    {
      name: "João Santos",
      email: "joao.santos@example.com",
      phone: "(11) 95432-1098",
      sessionFee: 220,
      frequency: "Semanal",
      status: "active" as const,
      paymentDay: 20,
      contractType: "pacote" as const,
      sessionsInPacket: 8,
      notes: "Pacote trimestral"
    },
    {
      name: "Beatriz Costa",
      email: "beatriz.costa@example.com",
      phone: "(11) 94321-0987",
      sessionFee: 180,
      frequency: "Eventual",
      status: "inactive" as const,
      paymentDay: 25,
      contractType: "avulso" as const,
      notes: "Em pausa temporária"
    }
  ];

  const createdPatients = [];
  for (const patientData of patientsData) {
    const [patient] = await db.insert(patients).values({
      ...patientData,
      userId,
      startedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 dias atrás
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    createdPatients.push(patient);
    console.log(`   ✓ ${patient.name}`);
  }

  // 4. Criar sessões e pagamentos
  console.log("\n📅 Criando sessões e pagamentos...");
  const sessionCategory = await db.query.categories.findFirst({
    where: eq(categories.name, "Sessões")
  });

  for (const patient of createdPatients.slice(0, 4)) { // Apenas pacientes ativos
    // Criar 8 sessões por paciente (últimas 8 semanas)
    for (let week = 0; week < 8; week++) {
      const sessionDate = new Date();
      sessionDate.setDate(sessionDate.getDate() - (week * 7));

      // Criar sessão
      const [session] = await db.insert(therapySessions).values({
        patientId: patient.id,
        userId,
        date: sessionDate,
        duration: 50,
        fee: patient.sessionFee,
        status: week === 0 ? "agendada" : "realizada",
        notes: week === 0 ? "Próxima sessão" : "Sessão realizada",
        chargeable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      // Criar pagamento para sessões realizadas
      if (week > 0) {
        const [payment] = await db.insert(sessionPayments).values({
          patientId: patient.id,
          sessionId: session.id,
          userId,
          amount: patient.sessionFee,
          date: sessionDate,
          method: ["pix", "card", "cash", "transfer"][Math.floor(Math.random() * 4)] as any,
          status: week > 2 ? "paid" : "pending",
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        // Se pago, criar transação financeira vinculada
        if (payment.status === "paid" && sessionCategory) {
          await db.insert(transactions).values({
            description: `Sessão - ${patient.name}`,
            amount: payment.amount,
            type: "income",
            date: sessionDate,
            categoryId: sessionCategory.id,
            accountId: account.id,
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }
    console.log(`   ✓ ${patient.name}: 8 sessões criadas`);
  }

  // 5. Criar algumas despesas
  console.log("\n💸 Criando despesas de exemplo...");
  const expenseCategories = await db.query.categories.findMany({
    where: eq(categories.type, "expense")
  });

  const expenses = [
    { desc: "Aluguel consultório - Agosto", amount: 2500, cat: "Aluguel Consultório" },
    { desc: "Papel A4 e canetas", amount: 85, cat: "Material Escritório" },
    { desc: "Curso de Atualização", amount: 450, cat: "Formação" },
    { desc: "Internet consultório", amount: 120, cat: "Outros" }
  ];

  for (const expense of expenses) {
    const category = expenseCategories.find(c => c.name === expense.cat) || expenseCategories[0];
    await db.insert(transactions).values({
      description: expense.desc,
      amount: expense.amount,
      type: "expense",
      date: new Date(),
      categoryId: category.id,
      accountId: account.id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`   ✓ ${expense.desc}: R$ ${expense.amount}`);
  }

  console.log("\n✨ Dados populados com sucesso!");
  console.log("\n📊 Resumo:");
  console.log(`   • 5 pacientes criados`);
  console.log(`   • 32 sessões agendadas/realizadas`);
  console.log(`   • Pagamentos e transações financeiras`);
  console.log(`   • 4 despesas de exemplo`);
  console.log(`   • Saldo inicial: R$ 15.000`);

  console.log("\n🎯 Gisele pode agora:");
  console.log("   1. Acessar: https://ledivan.com.br/login");
  console.log("   2. Fazer login com Google (giselebarrossantos@gmail.com)");
  console.log("   3. Ver o dashboard com dados de exemplo");
}

// Executa o script
populateGiseleData()
  .then(() => {
    console.log("\n✅ Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao popular dados:", error);
    process.exit(1);
  });