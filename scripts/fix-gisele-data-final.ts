import "dotenv/config";
import { db } from "../src/db";
import { users, patients } from "../src/db/schema";
import { eq, and, sql } from "drizzle-orm";

async function fixGiseleData() {
  console.log("\n" + "=".repeat(80));
  console.log("🔧 CORREÇÃO FINAL DOS DADOS DA GISELE - SUPERQA");
  console.log("=".repeat(80));

  try {
    // 1. Buscar usuário Gisele
    console.log("\n📊 1. VERIFICANDO USUÁRIO GISELE");

    const giseleUser = await db.query.users.findFirst({
      where: eq(users.email, "giselebarrossantos@gmail.com")
    });

    if (!giseleUser) {
      console.log("❌ Usuário Gisele não encontrado!");
      return;
    }

    console.log(`✅ Usuário encontrado: ${giseleUser.name} (${giseleUser.id})`);

    // 2. Buscar todos os pacientes
    console.log("\n📊 2. ANALISANDO PACIENTES");

    const allPatients = await db.query.patients.findMany({
      where: eq(patients.userId, giseleUser.id)
    });

    console.log(`   Total de pacientes: ${allPatients.length}`);

    // 3. Corrigir nomes em caixa alta
    console.log("\n📊 3. NORMALIZANDO NOMES");

    let namesFixed = 0;
    for (const patient of allPatients) {
      if (patient.name && patient.name === patient.name.toUpperCase()) {
        // Converter para Title Case
        const normalizedName = patient.name
          .toLowerCase()
          .split(" ")
          .map(word => {
            // Preservar preposições em minúscula
            if (["e", "de", "da", "do", "dos", "das"].includes(word)) {
              return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
          })
          .join(" ");

        await db.update(patients)
          .set({
            name: normalizedName,
            updatedAt: new Date()
          })
          .where(eq(patients.id, patient.id));

        namesFixed++;
        console.log(`   ✅ ${patient.name} → ${normalizedName}`);
      }
    }

    console.log(`   Total de nomes normalizados: ${namesFixed}`);

    // 4. Identificar e corrigir duplicados
    console.log("\n📊 4. VERIFICANDO DUPLICADOS");

    const duplicateCheck = await db.execute(sql`
      WITH duplicates AS (
        SELECT
          name,
          COUNT(*) as count,
          MIN(created_at) as first_created,
          MIN(id) as keep_id
        FROM patients
        WHERE user_id = ${giseleUser.id}
        GROUP BY UPPER(TRIM(name))
        HAVING COUNT(*) > 1
      )
      SELECT
        p.id,
        p.name,
        p.created_at,
        d.keep_id
      FROM patients p
      INNER JOIN duplicates d ON UPPER(TRIM(p.name)) = UPPER(TRIM(d.name))
      WHERE p.user_id = ${giseleUser.id}
        AND p.id != d.keep_id
      ORDER BY p.name, p.created_at
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log(`   ⚠️ Encontrados ${duplicateCheck.rows.length} duplicados`);

      for (const dup of duplicateCheck.rows) {
        console.log(`   - ${dup.name} (ID: ${dup.id}) - Duplicado de ${dup.keep_id}`);

        // Marcar como inativo em vez de deletar
        await db.update(patients)
          .set({
            status: "inativo",
            notes: `Duplicado de ${dup.keep_id} - Desativado em ${new Date().toISOString()}`,
            updatedAt: new Date()
          })
          .where(eq(patients.id, dup.id as string));
      }
    } else {
      console.log("   ✅ Nenhum duplicado encontrado");
    }

    // 5. Análise de valores de sessão
    console.log("\n📊 5. ANÁLISE DE VALORES DE SESSÃO");

    const valueAnalysis = await db.execute(sql`
      SELECT
        session_value,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM patients WHERE user_id = ${giseleUser.id})), 2) as percentage
      FROM patients
      WHERE user_id = ${giseleUser.id}
        AND status = 'ativo'
      GROUP BY session_value
      ORDER BY count DESC
    `);

    console.log("   Distribuição de valores:");
    for (const row of valueAnalysis.rows) {
      console.log(`   - R$ ${row.session_value}: ${row.count} pacientes (${row.percentage}%)`);
    }

    // 6. Análise de tipos de pagamento
    console.log("\n📊 6. ANÁLISE DE TIPOS DE PAGAMENTO");

    const typeAnalysis = await db.execute(sql`
      SELECT
        payment_type,
        COUNT(*) as count
      FROM patients
      WHERE user_id = ${giseleUser.id}
        AND status = 'ativo'
      GROUP BY payment_type
    `);

    for (const row of typeAnalysis.rows) {
      console.log(`   - ${row.payment_type || 'Não definido'}: ${row.count} pacientes`);
    }

    // 7. Sugestões de correção baseadas em valores
    console.log("\n📊 7. SUGESTÕES DE CORREÇÃO");
    console.log("   Baseado na análise, sugerimos:");
    console.log("   - Revisar valores individuais de cada paciente");
    console.log("   - Atualizar tipos de pagamento (Mensal, Quinzenal, Pacote)");
    console.log("   - Adicionar informações de contato faltantes");
    console.log("   - Verificar se 'HEITOR' são realmente dois pacientes diferentes");

    // 8. Relatório final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL SUPERQA");
    console.log("=".repeat(80));

    const finalStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'ativo' THEN 1 END) as active_patients,
        COUNT(CASE WHEN status = 'inativo' THEN 1 END) as inactive_patients,
        AVG(CASE WHEN status = 'ativo' THEN session_value END) as avg_value,
        MIN(CASE WHEN status = 'ativo' THEN session_value END) as min_value,
        MAX(CASE WHEN status = 'ativo' THEN session_value END) as max_value,
        COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as with_phone,
        COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email,
        COUNT(CASE WHEN cpf IS NOT NULL THEN 1 END) as with_cpf
      FROM patients
      WHERE user_id = ${giseleUser.id}
    `);

    const stats = finalStats.rows[0];

    console.log("\n✅ Estatísticas após correções:");
    console.log(`   - Total de pacientes: ${stats.total_patients}`);
    console.log(`   - Pacientes ativos: ${stats.active_patients}`);
    console.log(`   - Pacientes inativos: ${stats.inactive_patients}`);
    console.log(`   - Valor médio: R$ ${parseFloat(stats.avg_value as string).toFixed(2)}`);
    console.log(`   - Valor mínimo: R$ ${parseFloat(stats.min_value as string).toFixed(2)}`);
    console.log(`   - Valor máximo: R$ ${parseFloat(stats.max_value as string).toFixed(2)}`);
    console.log(`   - Com telefone: ${stats.with_phone}`);
    console.log(`   - Com email: ${stats.with_email}`);
    console.log(`   - Com CPF: ${stats.with_cpf}`);

    console.log("\n⚠️ AÇÕES MANUAIS NECESSÁRIAS:");
    console.log("   1. Revisar e ajustar valores de sessão individuais");
    console.log("   2. Definir tipos de pagamento corretos (Mensal/Quinzenal/Pacote)");
    console.log("   3. Adicionar dados de contato faltantes");
    console.log("   4. Verificar duplicação do paciente HEITOR");
    console.log("   5. Adicionar observações e histórico de tratamento");

    console.log("\n✅ CORREÇÕES AUTOMÁTICAS CONCLUÍDAS!");
    console.log("=" .repeat(80) + "\n");

  } catch (error) {
    console.error("❌ Erro durante correção:", error);
    throw error;
  }
}

// Executar correções
console.log("🚀 Iniciando correção SuperQA dos dados...");
fixGiseleData()
  .then(() => {
    console.log("✅ Processo concluído com sucesso!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });