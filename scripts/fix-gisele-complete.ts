import "dotenv/config";
import { db } from "../src/db";
import { users, patients, therapySessions } from "../src/db/schema";
import { eq, and, isNull, or, sql } from "drizzle-orm";

async function fixGiseleData() {
  console.log("\n" + "=".repeat(80));
  console.log("🔧 CORREÇÃO COMPLETA DOS DADOS DA GISELE");
  console.log("=".repeat(80));

  try {
    // 1. Verificar/Corrigir usuário Gisele
    console.log("\n📊 1. VERIFICANDO USUÁRIO GISELE");

    let giseleUser = await db.query.users.findFirst({
      where: eq(users.email, "giselebarrossantos@gmail.com")
    });

    if (!giseleUser) {
      console.log("❌ Usuário não encontrado. Criando...");

      const [newUser] = await db.insert(users).values({
        id: crypto.randomUUID(),
        email: "giselebarrossantos@gmail.com",
        name: "Gisele Barros Santos",
        role: "therapist",
        whatsappConnected: false,
        telegramConnected: false,
        googleCalendarConnected: false,
        meetProvider: "jitsi",
        weeklyReportsEnabled: true,
        reminderTime: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      giseleUser = newUser;
      console.log("✅ Usuário criado com sucesso!");
    } else {
      console.log("✅ Usuário encontrado. Verificando dados...");

      // Corrigir nome se necessário
      if (giseleUser.name !== "Gisele Barros Santos") {
        console.log(`   Corrigindo nome: ${giseleUser.name} → Gisele Barros Santos`);

        await db.update(users)
          .set({
            name: "Gisele Barros Santos",
            updatedAt: new Date()
          })
          .where(eq(users.id, giseleUser.id));
      }
    }

    // 2. Analisar e corrigir pacientes
    console.log("\n📊 2. ANALISANDO PACIENTES");

    const allPatients = await db.query.patients.findMany({
      where: eq(patients.userId, giseleUser.id)
    });

    console.log(`   Total de pacientes encontrados: ${allPatients.length}`);

    if (allPatients.length === 0) {
      console.log("⚠️ Nenhum paciente encontrado. Verificando se há pacientes órfãos...");

      // Buscar pacientes sem userId
      const orphanPatients = await db.query.patients.findMany({
        where: or(
          isNull(patients.userId),
          eq(patients.userId, "")
        )
      });

      if (orphanPatients.length > 0) {
        console.log(`   Encontrados ${orphanPatients.length} pacientes órfãos. Vinculando à Gisele...`);

        await db.update(patients)
          .set({
            userId: giseleUser.id,
            updatedAt: new Date()
          })
          .where(or(
            isNull(patients.userId),
            eq(patients.userId, "")
          ));

        console.log("✅ Pacientes órfãos vinculados!");
      }
    }

    // 3. Corrigir dados incompletos dos pacientes
    console.log("\n📊 3. CORRIGINDO DADOS INCOMPLETOS");

    // Buscar pacientes com problemas
    const problemPatients = await db.query.patients.findMany({
      where: and(
        eq(patients.userId, giseleUser.id),
        or(
          isNull(patients.paymentType),
          eq(patients.paymentType, ""),
          isNull(patients.sessionValue),
          eq(patients.sessionValue, 0)
        )
      )
    });

    if (problemPatients.length > 0) {
      console.log(`   Encontrados ${problemPatients.length} pacientes com dados incompletos`);

      for (const patient of problemPatients) {
        const updates: any = {};

        // Definir tipo de pagamento padrão se não existir
        if (!patient.paymentType || patient.paymentType === "") {
          updates.paymentType = "Avulso";
        }

        // Definir valor de sessão padrão se não existir
        if (!patient.sessionValue || patient.sessionValue === 0) {
          // Usar valor médio baseado no nome ou valor padrão
          if (patient.name?.toLowerCase().includes("vip") || patient.name?.toLowerCase().includes("premium")) {
            updates.sessionValue = 180;
          } else {
            updates.sessionValue = 100; // Valor padrão
          }
        }

        // Garantir que tem status
        if (!patient.status) {
          updates.status = "ativo";
        }

        // Aplicar correções
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();

          await db.update(patients)
            .set(updates)
            .where(eq(patients.id, patient.id));

          console.log(`   ✅ Corrigido: ${patient.name} - ${Object.keys(updates).join(", ")}`);
        }
      }
    }

    // 4. Corrigir nomes em caixa alta
    console.log("\n📊 4. NORMALIZANDO NOMES");

    const upperCasePatients = await db.query.patients.findMany({
      where: eq(patients.userId, giseleUser.id)
    });

    let normalizedCount = 0;
    for (const patient of upperCasePatients) {
      if (patient.name && patient.name === patient.name.toUpperCase()) {
        // Converter para Title Case
        const normalizedName = patient.name
          .toLowerCase()
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        await db.update(patients)
          .set({
            name: normalizedName,
            updatedAt: new Date()
          })
          .where(eq(patients.id, patient.id));

        normalizedCount++;
        console.log(`   ✅ Normalizado: ${patient.name} → ${normalizedName}`);
      }
    }

    if (normalizedCount > 0) {
      console.log(`   Total de nomes normalizados: ${normalizedCount}`);
    }

    // 5. Remover duplicados
    console.log("\n📊 5. VERIFICANDO DUPLICADOS");

    const duplicateCheck = await db.execute(sql`
      WITH duplicates AS (
        SELECT
          name,
          COUNT(*) as count,
          MIN(id) as keep_id
        FROM patients
        WHERE user_id = ${giseleUser.id}
          AND name IS NOT NULL
          AND name != ''
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
    `);

    if (duplicateCheck.rows.length > 0) {
      console.log(`   ⚠️ Encontrados ${duplicateCheck.rows.length} duplicados`);

      // Perguntar antes de remover
      console.log("   Duplicados serão marcados como inativos (não deletados)");

      for (const dup of duplicateCheck.rows) {
        await db.update(patients)
          .set({
            status: "inativo",
            notes: `Duplicado de ${dup.keep_id} - Desativado automaticamente`,
            updatedAt: new Date()
          })
          .where(eq(patients.id, dup.id as string));

        console.log(`   ✅ Desativado duplicado: ${dup.name}`);
      }
    } else {
      console.log("   ✅ Nenhum duplicado encontrado");
    }

    // 6. Relatório final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL");
    console.log("=".repeat(80));

    // Estatísticas finais
    const finalStats = await db.execute(sql`
      SELECT
        COUNT(*) as total_patients,
        COUNT(CASE WHEN status = 'ativo' THEN 1 END) as active_patients,
        COUNT(CASE WHEN session_value > 0 THEN 1 END) as with_value,
        COUNT(CASE WHEN payment_type IS NOT NULL AND payment_type != '' THEN 1 END) as with_type,
        AVG(session_value) as avg_value
      FROM patients
      WHERE user_id = ${giseleUser.id}
    `);

    const stats = finalStats.rows[0];
    console.log("\n✅ Estatísticas após correções:");
    console.log(`   - Total de pacientes: ${stats.total_patients}`);
    console.log(`   - Pacientes ativos: ${stats.active_patients}`);
    console.log(`   - Com valor definido: ${stats.with_value}`);
    console.log(`   - Com tipo de pagamento: ${stats.with_type}`);
    console.log(`   - Valor médio da sessão: R$ ${parseFloat(stats.avg_value as string).toFixed(2)}`);

    // Verificar sessões
    const sessionCount = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM therapy_sessions
      WHERE user_id = ${giseleUser.id}
    `);

    console.log(`   - Total de sessões: ${sessionCount.rows[0].count}`);

    console.log("\n✅ CORREÇÕES CONCLUÍDAS COM SUCESSO!");
    console.log("=" .repeat(80) + "\n");

  } catch (error) {
    console.error("❌ Erro durante correção:", error);
    throw error;
  }
}

// Executar correções
console.log("🚀 Iniciando correção dos dados...");
fixGiseleData()
  .then(() => {
    console.log("✅ Processo concluído com sucesso!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });