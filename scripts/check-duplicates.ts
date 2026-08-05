import "dotenv/config";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Script para verificar e listar possíveis duplicatas
 */

async function checkDuplicates() {
  console.log("🔍 Verificando duplicatas de pacientes...\n");

  const allPatients = await db.query.patients.findMany();

  // Agrupar por nome
  const groupedByName = allPatients.reduce((acc: any, patient) => {
    const key = patient.name.toUpperCase().trim();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(patient);
    return acc;
  }, {});

  // Encontrar duplicatas
  const duplicates = Object.entries(groupedByName)
    .filter(([_, patients]: [string, any]) => patients.length > 1)
    .map(([name, patients]: [string, any]) => ({
      name,
      count: patients.length,
      patients: patients.map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        userId: p.userId,
        createdAt: p.createdAt
      }))
    }));

  if (duplicates.length === 0) {
    console.log("✅ Nenhuma duplicata encontrada!");
    return;
  }

  console.log(`⚠️  Encontradas ${duplicates.length} possíveis duplicatas:\n`);

  for (const dup of duplicates) {
    console.log(`📋 ${dup.name} (${dup.count} registros):`);

    // Analisar se são realmente duplicatas
    const uniqueUserIds = new Set(dup.patients.map((p: any) => p.userId));

    if (uniqueUserIds.size === 1) {
      // Mesma usuária - provavelmente duplicata real
      console.log(`   ⚠️  DUPLICATA REAL - mesmo usuário`);

      // Mostrar detalhes
      dup.patients.forEach((p: any, index: number) => {
        const isPrimary = index === 0;
        console.log(`   ${isPrimary ? '✅' : '❌'} ID: ${p.id.substring(0, 8)}... Status: ${p.status || 'N/A'}`);
      });

      // Sugerir qual manter (o mais antigo)
      const oldest = dup.patients.sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];

      console.log(`   💡 Recomendação: Manter ID ${oldest.id.substring(0, 8)}... (mais antigo)`);
    } else {
      // Usuários diferentes - provavelmente não é duplicata
      console.log(`   ℹ️  Usuários diferentes - verificar se são pessoas diferentes`);
      uniqueUserIds.forEach(userId => {
        console.log(`      User: ${userId.substring(0, 8)}...`);
      });
    }

    console.log('');
  }

  // Verificar HEITOR especificamente (apareceu duplicado nos testes)
  const heitores = allPatients.filter(p => p.name.includes('HEITOR'));
  if (heitores.length > 1) {
    console.log("🔍 Análise específica - HEITOR:");
    heitores.forEach((h, i) => {
      console.log(`   ${i + 1}. ID: ${h.id.substring(0, 8)}... Nome: "${h.name}" UserId: ${h.userId.substring(0, 8)}...`);
    });
  }

  console.log("\n📊 Resumo:");
  console.log(`   Total de pacientes: ${allPatients.length}`);
  console.log(`   Possíveis duplicatas: ${duplicates.length}`);
  console.log(`   Registros afetados: ${duplicates.reduce((sum, d) => sum + d.count, 0)}`);
}

// Executar
checkDuplicates()
  .then(() => {
    console.log("\n✨ Verificação concluída!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });