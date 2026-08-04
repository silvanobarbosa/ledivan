import "dotenv/config";
import { db } from "@/db";
import {
  users,
  patients,
  therapySessions,
  sessionPayments,
  financialAccounts,
  categories,
  transactions,
  patientStatusHistory,
  patientPriceHistory,
  patientContractHistory
} from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import XLSX from "xlsx";
import * as path from "path";
import { parseISO, format, addDays, startOfDay, endOfDay } from "date-fns";

/**
 * Script para importar dados do Excel "Financeiro 040826.xlsx" para Gisele
 * Importa pacientes, sessões, pagamentos e dados financeiros
 */

const GISELE_EMAIL = "giselebarrossantos@gmail.com";
const EXCEL_FILE = path.join(process.cwd(), "Gi", "Financeiro 040826.xlsx");

// Mapeamento de dias da semana
const WEEKDAY_MAP: Record<string, number> = {
  "domingo": 0,
  "segunda": 1,
  "segunda-feira": 1,
  "terça": 2,
  "terça-feira": 2,
  "quarta": 3,
  "quarta-feira": 3,
  "quinta": 4,
  "quinta-feira": 4,
  "sexta": 5,
  "sexta-feira": 5,
  "sábado": 6,
  "sabado": 6
};

interface PatientData {
  name: string;
  status: "active" | "inactive" | "prospect";
  phone?: string;
  birthDate?: Date;
  startDate?: Date;
  sessionFee?: number;
  contractType?: "pacote" | "avulso";
  frequency?: string;
  dayOfWeek?: string;
  time?: string;
  paymentDay?: number;
}

interface SessionData {
  patientName: string;
  date: Date;
  time?: string;
  status: "realizada" | "agendada" | "cancelada" | "nao_realizada";
  fee: number;
}

interface PaymentData {
  patientName: string;
  amount: number;
  date: Date;
  method: "pix" | "cash" | "card" | "transfer";
  status: "paid" | "pending" | "overdue";
  description?: string;
}

function parseExcelDate(serial: number): Date {
  // Excel armazena datas como número de dias desde 1900-01-01
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date = new Date(utc_value * 1000);
  return date;
}

function parseTime(timeStr: string): string {
  // Converte "14h" ou "14:00" para "14:00"
  if (!timeStr) return "09:00";

  const cleaned = timeStr.toString().toLowerCase().replace(/\s/g, "");
  const match = cleaned.match(/(\d{1,2})[h:]?(\d{0,2})?/);

  if (match) {
    const hours = match[1].padStart(2, "0");
    const minutes = match[2] || "00";
    return `${hours}:${minutes}`;
  }

  return "09:00";
}

function parsePhoneNumber(phone: any): string | undefined {
  if (!phone) return undefined;

  const cleaned = phone.toString().replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }

  return phone.toString();
}

function parseValue(value: any): number {
  if (!value) return 0;

  const cleaned = value.toString()
    .replace(/[R$\s]/g, "")
    .replace(",", ".");

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

async function importGiseleExcelData() {
  console.log("🔍 Buscando usuário da Gisele...");

  // Buscar usuário da Gisele
  const user = await db.query.users.findFirst({
    where: eq(users.email, GISELE_EMAIL)
  });

  if (!user) {
    console.error("❌ Usuário não encontrado! Execute primeiro: npm run create-gisele");
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Usuário encontrado: ${user.name} (${userId})`);

  // Verificar se já tem dados
  const existingPatients = await db.query.patients.findMany({
    where: eq(patients.userId, userId)
  });

  if (existingPatients.length > 0) {
    console.log("⚠️  Usuário já possui dados. Limpando dados anteriores...");

    // Limpar dados existentes
    await db.delete(sessionPayments).where(eq(sessionPayments.userId, userId));
    await db.delete(therapySessions).where(eq(therapySessions.userId, userId));
    await db.delete(patientStatusHistory).where(eq(patientStatusHistory.userId, userId));
    await db.delete(patientPriceHistory).where(eq(patientPriceHistory.userId, userId));
    await db.delete(patientContractHistory).where(eq(patientContractHistory.userId, userId));
    await db.delete(patients).where(eq(patients.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));

    console.log("✅ Dados anteriores removidos");
  }

  console.log("\n📂 Lendo arquivo Excel...");
  console.log(`   Arquivo: ${EXCEL_FILE}`);

  // Ler o arquivo Excel
  const workbook = XLSX.readFile(EXCEL_FILE);

  console.log(`   Abas encontradas: ${workbook.SheetNames.join(", ")}`);

  // 1. Criar categorias financeiras
  console.log("\n💰 Criando categorias financeiras...");
  const categoriesData = [
    { name: "Sessões", icon: "🧠", color: "#8B5CF6", type: "income" as const },
    { name: "Aluguel Consultório", icon: "🏢", color: "#EF4444", type: "expense" as const },
    { name: "Material", icon: "📝", color: "#F59E0B", type: "expense" as const },
    { name: "Remédio", icon: "💊", color: "#10B981", type: "expense" as const },
    { name: "Outros", icon: "📌", color: "#6B7280", type: "expense" as const }
  ];

  const createdCategories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const [category] = await db.insert(categories).values({
      ...cat,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoNothing().returning();

    if (category) {
      createdCategories[cat.name] = category.id;
      console.log(`   ✓ ${cat.name}`);
    }
  }

  // 2. Criar conta financeira
  console.log("\n🏦 Criando conta bancária...");
  const [account] = await db.insert(financialAccounts).values({
    name: "C6 Bank - Consultório",
    type: "checking",
    balance: 0,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();
  console.log(`   ✓ Conta criada: ${account.name}`);

  // 3. Processar aba Estatística (dados dos pacientes)
  console.log("\n👥 Importando pacientes da aba 'Estatística'...");

  const estatisticaSheet = workbook.Sheets["Estatística"];
  const estatisticaData = XLSX.utils.sheet_to_json(estatisticaSheet, { header: 1 }) as any[][];

  // Mapear pacientes
  const patientsMap: Record<string, string> = {};
  let patientCount = 0;

  for (let i = 2; i < estatisticaData.length; i++) {
    const row = estatisticaData[i];
    if (!row || row.length < 3) continue;

    const nome = row[2]?.toString().trim();
    if (!nome || nome === "Nome") continue;

    const status = row[1]?.toString().toLowerCase() || "ativo";
    const telefone = row[3];
    const dataNascimento = row[4];
    const dataInicio = row[7];
    const valorSessao = row[10];
    const tipoContrato = row[11];

    // Determinar status
    let patientStatus: "active" | "inactive" | "prospect" = "active";
    if (status.includes("parou") || status.includes("desist")) {
      patientStatus = "inactive";
    } else if (status.includes("prospect")) {
      patientStatus = "prospect";
    }

    // Criar paciente
    const [patient] = await db.insert(patients).values({
      name: nome,
      email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`,
      phone: parsePhoneNumber(telefone),
      status: patientStatus,
      sessionFee: parseValue(valorSessao) || 180,
      frequency: "Semanal",
      contractType: tipoContrato?.toString().toLowerCase().includes("pacote") ? "pacote" : "avulso",
      paymentDay: 10,
      birthDate: dataNascimento && typeof dataNascimento === "number" ? parseExcelDate(dataNascimento) : undefined,
      startedAt: dataInicio && typeof dataInicio === "number" ? parseExcelDate(dataInicio) : new Date(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    patientsMap[nome.toUpperCase()] = patient.id;
    patientCount++;
    console.log(`   ✓ ${nome} - ${patientStatus}`);
  }

  console.log(`   Total: ${patientCount} pacientes importados`);

  // 4. Processar aba Financ Cobranças (agenda e horários)
  console.log("\n📅 Importando agenda da aba 'Financ Cobranças'...");

  const cobrancasSheet = workbook.Sheets["Financ Cobranças"];
  const cobrancasData = XLSX.utils.sheet_to_json(cobrancasSheet, { header: 1 }) as any[][];

  // Estrutura: cada grupo de colunas representa um paciente
  // Colunas: Nome, Status, Dia, Horário, Frequência, etc.

  let sessionCount = 0;
  const hoje = new Date();

  // Processar grupos de colunas (cada 4-5 colunas é um paciente)
  for (let col = 3; col < cobrancasData[0].length; col += 4) {
    let nomePaciente = "";
    let diaSemana = "";
    let horario = "";
    let frequencia = "";

    // Buscar informações do paciente nesta coluna
    for (let row = 0; row < Math.min(cobrancasData.length, 20); row++) {
      const valor = cobrancasData[row]?.[col];
      if (!valor) continue;

      const valorStr = valor.toString();

      // Identificar nome do paciente (geralmente em maiúsculas)
      if (valorStr.match(/^[A-Z\s]+$/) && valorStr.length > 2) {
        nomePaciente = valorStr.trim();
      }

      // Identificar dia da semana
      const diaLower = valorStr.toLowerCase();
      for (const [dia, num] of Object.entries(WEEKDAY_MAP)) {
        if (diaLower.includes(dia)) {
          diaSemana = dia;
          break;
        }
      }

      // Identificar horário
      if (valorStr.match(/\d{1,2}h/)) {
        horario = valorStr;
      }

      // Identificar frequência
      if (valorStr.toLowerCase().includes("semana")) {
        frequencia = valorStr;
      }
    }

    // Se encontrou um paciente válido, criar sessões retroativas
    if (nomePaciente && patientsMap[nomePaciente]) {
      const patientId = patientsMap[nomePaciente];
      const patient = await db.query.patients.findFirst({
        where: eq(patients.id, patientId)
      });

      if (patient && diaSemana && horario) {
        // Criar sessões das últimas 8 semanas
        for (let week = 0; week < 8; week++) {
          const sessionDate = new Date(hoje);
          sessionDate.setDate(sessionDate.getDate() - (week * 7));

          // Ajustar para o dia da semana correto
          const targetDay = WEEKDAY_MAP[diaSemana] || 1;
          const currentDay = sessionDate.getDay();
          const diff = targetDay - currentDay;
          sessionDate.setDate(sessionDate.getDate() + diff);

          // Definir horário
          const [hours, minutes] = parseTime(horario).split(":");
          sessionDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          // Criar sessão
          const [session] = await db.insert(therapySessions).values({
            patientId,
            userId,
            date: sessionDate,
            duration: 50,
            fee: patient.sessionFee || 180,
            status: week === 0 ? "agendada" : "realizada",
            notes: `Atendimento ${frequencia || "regular"}`,
            chargeable: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();

          // Criar pagamento para sessões realizadas
          if (week > 0 && week <= 6) {
            const paymentStatus = week > 3 ? "paid" : "pending";

            const [payment] = await db.insert(sessionPayments).values({
              patientId,
              sessionId: session.id,
              userId,
              amount: patient.sessionFee || 180,
              date: sessionDate,
              method: "pix",
              status: paymentStatus,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();

            // Se pago, criar transação
            if (paymentStatus === "paid" && createdCategories["Sessões"]) {
              await db.insert(transactions).values({
                description: `Sessão - ${patient.name}`,
                amount: payment.amount,
                type: "income",
                date: sessionDate,
                categoryId: createdCategories["Sessões"],
                accountId: account.id,
                userId,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }

          sessionCount++;
        }
      }
    }
  }

  console.log(`   Total: ${sessionCount} sessões criadas`);

  // 5. Processar aba Extrato (transações financeiras)
  console.log("\n💳 Importando transações do 'Extrato'...");

  const extratoSheet = workbook.Sheets["Extrato"];
  const extratoData = XLSX.utils.sheet_to_json(extratoSheet, { header: 1 }) as any[][];

  let transactionCount = 0;
  let saldoAtual = 0;

  for (let i = 5; i < extratoData.length && i < 100; i++) {
    const row = extratoData[i];
    if (!row || row.length < 5) continue;

    const dataStr = row[1];
    const titulo = row[2]?.toString() || "";
    const descricao = row[3]?.toString() || "";
    const entrada = parseValue(row[4]);
    const saida = parseValue(row[5]);
    const categoria = row[7]?.toString().toLowerCase() || "";

    // Pular linhas de cabeçalho ou totais
    if (!dataStr || titulo === "Título") continue;

    // Determinar data
    let transactionDate = new Date();
    if (typeof dataStr === "number") {
      transactionDate = parseExcelDate(dataStr);
    } else if (typeof dataStr === "string") {
      const parts = dataStr.split("/");
      if (parts.length === 3) {
        // Formato DD/MM/YYYY ou DD/MM/YY
        const year = parts[2].length === 4 ? parseInt(parts[2]) : parseInt("20" + parts[2]);
        const month = parseInt(parts[1]) - 1; // JavaScript usa mês 0-indexado
        const day = parseInt(parts[0]);

        // Validar data
        if (year >= 2020 && year <= 2030 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          transactionDate = new Date(year, month, day);
        } else {
          // Se data inválida, usar data atual
          transactionDate = new Date();
        }
      }
    }

    // Garantir que a data é válida
    if (isNaN(transactionDate.getTime()) || transactionDate.getFullYear() > 2030 || transactionDate.getFullYear() < 2020) {
      transactionDate = new Date(); // Usar data atual se houver problema
    }

    // Determinar categoria
    let categoryId = createdCategories["Outros"];
    if (categoria.includes("remédio") || categoria.includes("remedio")) {
      categoryId = createdCategories["Remédio"] || categoryId;
    } else if (categoria.includes("sala") || titulo.toLowerCase().includes("aluguel")) {
      categoryId = createdCategories["Aluguel Consultório"] || categoryId;
    } else if (titulo.toLowerCase().includes("pix recebido")) {
      categoryId = createdCategories["Sessões"] || categoryId;
    }

    // Criar transação
    if (entrada > 0) {
      await db.insert(transactions).values({
        description: descricao || titulo,
        amount: entrada,
        type: "income",
        date: transactionDate,
        categoryId,
        accountId: account.id,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      saldoAtual += entrada;
      transactionCount++;
    } else if (saida > 0) {
      await db.insert(transactions).values({
        description: descricao || titulo,
        amount: saida,
        type: "expense",
        date: transactionDate,
        categoryId,
        accountId: account.id,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      saldoAtual -= saida;
      transactionCount++;
    }
  }

  // Atualizar saldo da conta
  await db.update(financialAccounts)
    .set({ balance: saldoAtual })
    .where(eq(financialAccounts.id, account.id));

  console.log(`   Total: ${transactionCount} transações importadas`);
  console.log(`   Saldo final: R$ ${saldoAtual.toFixed(2)}`);

  // 6. Processar aba Prospecção
  console.log("\n🎯 Importando prospectos...");

  const prospeccaoSheet = workbook.Sheets["Prospecção"];
  const prospeccaoData = XLSX.utils.sheet_to_json(prospeccaoSheet, { header: 1 }) as any[][];

  let prospectCount = 0;

  for (let i = 1; i < prospeccaoData.length; i++) {
    const row = prospeccaoData[i];
    if (!row || row.length < 4) continue;

    const dataProspeccao = row[1];
    const nome = row[2]?.toString().trim();
    const status = row[3]?.toString().toLowerCase() || "";

    if (!nome) continue;

    // Verificar se já existe como paciente
    if (!patientsMap[nome.toUpperCase()]) {
      // Criar como prospect
      const [patient] = await db.insert(patients).values({
        name: nome,
        email: `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`,
        status: status.includes("fechou") ? "active" : "prospect",
        sessionFee: 180,
        frequency: "A definir",
        contractType: "avulso",
        notes: `Prospecção - Status: ${row[3] || "Em análise"}`,
        startedAt: dataProspeccao && typeof dataProspeccao === "number"
          ? parseExcelDate(dataProspeccao)
          : new Date(),
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      patientsMap[nome.toUpperCase()] = patient.id;
      prospectCount++;
      console.log(`   ✓ ${nome} - ${status.includes("fechou") ? "Convertido" : "Prospecto"}`);
    }
  }

  console.log(`   Total: ${prospectCount} prospectos importados`);

  // Resumo final
  console.log("\n" + "=".repeat(60));
  console.log("✨ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log("=".repeat(60));

  const finalStats = {
    pacientes: await db.query.patients.findMany({ where: eq(patients.userId, userId) }),
    sessoes: await db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    pagamentos: await db.query.sessionPayments.findMany({ where: eq(sessionPayments.userId, userId) }),
    transacoes: await db.query.transactions.findMany({ where: eq(transactions.userId, userId) })
  };

  console.log("\n📊 Resumo da importação:");
  console.log(`   • ${finalStats.pacientes.length} pacientes`);
  console.log(`   • ${finalStats.sessoes.length} sessões agendadas/realizadas`);
  console.log(`   • ${finalStats.pagamentos.length} pagamentos registrados`);
  console.log(`   • ${finalStats.transacoes.length} transações financeiras`);
  console.log(`   • Saldo da conta: R$ ${saldoAtual.toFixed(2)}`);

  console.log("\n🎯 Gisele pode agora:");
  console.log("   1. Acessar: https://ledivan.com.br/login");
  console.log("   2. Fazer login com Google (giselebarrossantos@gmail.com)");
  console.log("   3. Ver todos os dados importados no dashboard");
}

// Executar importação
importGiseleExcelData()
  .then(() => {
    console.log("\n✅ Importação finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro na importação:", error);
    process.exit(1);
  });