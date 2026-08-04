import "dotenv/config";
import { db } from "@/db";
import { users, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import XLSX from "xlsx";
import * as path from "path";

/**
 * Script simplificado para importar dados do Excel para Gisele
 * Foca nos pacientes principais da aba Estatística
 */

const GISELE_EMAIL = "giselebarrossantos@gmail.com";
const EXCEL_FILE = path.join(process.cwd(), "Gi", "Financeiro 040826.xlsx");

async function importExcelSimple() {
  console.log("🔍 Buscando usuário da Gisele...");

  // Buscar usuário da Gisele
  const user = await db.query.users.findFirst({
    where: eq(users.email, GISELE_EMAIL)
  });

  if (!user) {
    console.error("❌ Usuário não encontrado!");
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅ Usuário: ${user.name}`);

  console.log("\n📂 Lendo Excel...");
  const workbook = XLSX.readFile(EXCEL_FILE);

  // Processar aba Estatística
  console.log("\n👥 Importando pacientes...");
  const sheet = workbook.Sheets["Estatística"];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  let imported = 0;
  const pacientesImportados = [];

  for (let i = 2; i < data.length && i < 52; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    const nome = row[2]?.toString().trim();
    if (!nome || nome === "Nome" || nome.length < 2) continue;

    const status = row[1]?.toString().toLowerCase() || "";
    const telefone = row[3]?.toString() || "";
    const valorSessao = parseFloat(row[10]?.toString().replace(/[R$\s]/g, "").replace(",", ".")) || 180;

    // Determinar status do paciente
    let patientStatus: "active" | "inactive" | "prospect" = "active";
    if (status.includes("parou") || status.includes("desist")) {
      patientStatus = "inactive";
    }

    // Verificar se já existe
    const existing = await db.query.patients.findFirst({
      where: eq(patients.name, nome)
    });

    if (existing) {
      console.log(`   ⚠️  ${nome} já existe`);
      continue;
    }

    // Criar paciente
    try {
      const [patient] = await db.insert(patients).values({
        name: nome,
        email: `${nome.toLowerCase().replace(/\s+/g, ".")}@paciente.com`,
        phone: telefone || undefined,
        status: patientStatus,
        sessionFee: valorSessao,
        frequency: "Semanal",
        contractType: "avulso",
        paymentDay: 10,
        startedAt: new Date(),
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      pacientesImportados.push({
        nome: patient.name,
        status: patient.status,
        valor: patient.sessionFee
      });

      imported++;
      console.log(`   ✓ ${nome} - ${patientStatus} - R$ ${valorSessao}`);
    } catch (error) {
      console.log(`   ❌ Erro ao criar ${nome}: ${error}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ IMPORTAÇÃO CONCLUÍDA!");
  console.log("=".repeat(60));
  console.log(`\n📊 Resumo:`);
  console.log(`   • Total importado: ${imported} pacientes`);
  console.log(`   • Ativos: ${pacientesImportados.filter(p => p.status === "active").length}`);
  console.log(`   • Inativos: ${pacientesImportados.filter(p => p.status === "inactive").length}`);

  console.log("\n💰 Valores das sessões:");
  const valores = pacientesImportados.map(p => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  console.log(`   • Mínimo: R$ ${min.toFixed(2)}`);
  console.log(`   • Máximo: R$ ${max.toFixed(2)}`);
  console.log(`   • Média: R$ ${media.toFixed(2)}`);

  console.log("\n🎯 Próximos passos:");
  console.log("   1. Gisele acessa: https://ledivan.com.br");
  console.log("   2. Login com Google: giselebarrossantos@gmail.com");
  console.log("   3. Ver pacientes importados no dashboard");
}

// Executar
importExcelSimple()
  .then(() => {
    console.log("\n✅ Sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });