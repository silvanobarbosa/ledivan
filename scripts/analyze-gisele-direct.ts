import { sql } from "@neon/serverless";
import dotenv from "dotenv";
import path from "path";

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não encontrada no .env.local");
  process.exit(1);
}

async function analyzeGiseleData() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 SUPERQA - ANÁLISE DIRETA DOS DADOS DA GISELE");
  console.log("=".repeat(80));

  const db = sql(DATABASE_URL);

  try {
    // 1. Analisar usuário Gisele
    console.log("\n📊 1. DADOS DO USUÁRIO GISELE");
    const userResult = await db`
      SELECT * FROM users
      WHERE email = 'giselebarrossantos@gmail.com'
      LIMIT 1
    `;

    if (userResult.length === 0) {
      console.log("❌ Usuário Gisele não encontrado!");
      console.log("   Tentando com variações de email...");

      const variations = await db`
        SELECT email, name, id, created_at
        FROM users
        WHERE email LIKE '%gisele%' OR name LIKE '%Gisele%'
      `;

      if (variations.length > 0) {
        console.log("   Possíveis matches encontrados:");
        variations.forEach(u => {
          console.log(`   - ${u.email} | ${u.name} | ID: ${u.id}`);
        });
      }
      return;
    }

    const giseleUser = userResult[0];
    console.log("✅ Usuário encontrado:");
    console.log(`   - ID: ${giseleUser.id}`);
    console.log(`   - Nome: ${giseleUser.name}`);
    console.log(`   - Email: ${giseleUser.email}`);
    console.log(`   - Criado em: ${new Date(giseleUser.created_at).toLocaleDateString('pt-BR')}`);

    // 2. Analisar pacientes
    console.log("\n📊 2. ANÁLISE DE PACIENTES");
    const patientsCount = await db`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'ativo' THEN 1 END) as ativos,
        COUNT(CASE WHEN status = 'inativo' THEN 1 END) as inativos,
        COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) as sem_nome,
        COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as sem_email,
        COUNT(CASE WHEN phone IS NULL OR phone = '' THEN 1 END) as sem_telefone,
        COUNT(CASE WHEN session_value IS NULL OR session_value <= 0 THEN 1 END) as sem_valor,
        COUNT(CASE WHEN payment_type IS NULL OR payment_type = '' THEN 1 END) as sem_tipo
      FROM patients
      WHERE user_id = ${giseleUser.id}
    `;

    const stats = patientsCount[0];
    console.log(`   Total de pacientes: ${stats.total}`);
    console.log(`   - Ativos: ${stats.ativos}`);
    console.log(`   - Inativos: ${stats.inativos}`);
    console.log(`   - Sem nome: ${stats.sem_nome}`);
    console.log(`   - Sem email: ${stats.sem_email}`);
    console.log(`   - Sem telefone: ${stats.sem_telefone}`);
    console.log(`   - Sem valor de sessão: ${stats.sem_valor}`);
    console.log(`   - Sem tipo de pagamento: ${stats.sem_tipo}`);

    // 3. Verificar pacientes com problemas
    console.log("\n📊 3. PACIENTES COM PROBLEMAS DE DADOS");
    const problemPatients = await db`
      SELECT
        name,
        email,
        phone,
        session_value,
        payment_type,
        status,
        created_at
      FROM patients
      WHERE user_id = ${giseleUser.id}
        AND (
          name IS NULL OR name = '' OR
          email IS NULL OR email = '' OR
          phone IS NULL OR phone = '' OR
          session_value IS NULL OR session_value <= 0 OR
          payment_type IS NULL OR payment_type = ''
        )
      LIMIT 10
    `;

    if (problemPatients.length > 0) {
      console.log("⚠️ Pacientes com dados incompletos:");
      problemPatients.forEach(p => {
        const problems = [];
        if (!p.name) problems.push("sem nome");
        if (!p.email) problems.push("sem email");
        if (!p.phone) problems.push("sem telefone");
        if (!p.session_value || p.session_value <= 0) problems.push("sem valor");
        if (!p.payment_type) problems.push("sem tipo pagamento");

        console.log(`   - ${p.name || "[SEM NOME]"}: ${problems.join(", ")}`);
      });
    }

    // 4. Verificar duplicados
    console.log("\n📊 4. VERIFICAÇÃO DE DUPLICADOS");
    const duplicates = await db`
      SELECT
        UPPER(TRIM(name)) as nome_normalizado,
        COUNT(*) as quantidade
      FROM patients
      WHERE user_id = ${giseleUser.id}
        AND name IS NOT NULL
        AND name != ''
      GROUP BY UPPER(TRIM(name))
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `;

    if (duplicates.length > 0) {
      console.log("⚠️ Nomes duplicados encontrados:");
      duplicates.forEach(d => {
        console.log(`   - ${d.nome_normalizado}: ${d.quantidade} ocorrências`);
      });
    } else {
      console.log("✅ Nenhum nome duplicado encontrado");
    }

    // 5. Analisar sessões
    console.log("\n📊 5. ANÁLISE DE SESSÕES");
    const sessionsStats = await db`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'confirmada' THEN 1 END) as confirmadas,
        COUNT(CASE WHEN status = 'pendente' THEN 1 END) as pendentes,
        COUNT(CASE WHEN status = 'cancelada' THEN 1 END) as canceladas,
        COUNT(CASE WHEN status = 'falta' THEN 1 END) as faltas
      FROM therapy_sessions
      WHERE user_id = ${giseleUser.id}
    `;

    const sessionData = sessionsStats[0];
    console.log(`   Total de sessões: ${sessionData.total}`);
    if (sessionData.total > 0) {
      console.log(`   - Confirmadas: ${sessionData.confirmadas}`);
      console.log(`   - Pendentes: ${sessionData.pendentes}`);
      console.log(`   - Canceladas: ${sessionData.canceladas}`);
      console.log(`   - Faltas: ${sessionData.faltas}`);
    }

    // 6. Analisar transações financeiras
    console.log("\n📊 6. ANÁLISE FINANCEIRA");
    const financialStats = await db`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN type = 'receita' THEN 1 END) as receitas,
        COUNT(CASE WHEN type = 'despesa' THEN 1 END) as despesas,
        COALESCE(SUM(CASE WHEN type = 'receita' THEN value END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN type = 'despesa' THEN value END), 0) as total_despesas
      FROM transactions
      WHERE user_id = ${giseleUser.id}
    `;

    const finData = financialStats[0];
    console.log(`   Total de transações: ${finData.total}`);
    if (finData.total > 0) {
      console.log(`   - Receitas: ${finData.receitas} (R$ ${parseFloat(finData.total_receitas).toFixed(2)})`);
      console.log(`   - Despesas: ${finData.despesas} (R$ ${parseFloat(finData.total_despesas).toFixed(2)})`);
      console.log(`   - Saldo: R$ ${(parseFloat(finData.total_receitas) - parseFloat(finData.total_despesas)).toFixed(2)}`);
    }

    // 7. Verificar integridade referencial
    console.log("\n📊 7. INTEGRIDADE DOS DADOS");

    // Pacientes órfãos
    const orphanPatients = await db`
      SELECT COUNT(*) as count
      FROM patients
      WHERE user_id IS NULL OR user_id = ''
    `;

    if (orphanPatients[0].count > 0) {
      console.log(`❌ ${orphanPatients[0].count} paciente(s) órfão(s) encontrado(s)`);
    }

    // Sessões sem paciente válido
    const orphanSessions = await db`
      SELECT COUNT(*) as count
      FROM therapy_sessions ts
      WHERE ts.user_id = ${giseleUser.id}
        AND NOT EXISTS (
          SELECT 1 FROM patients p
          WHERE p.id = ts.patient_id
          AND p.user_id = ts.user_id
        )
    `;

    if (orphanSessions[0].count > 0) {
      console.log(`❌ ${orphanSessions[0].count} sessão(ões) com paciente inválido`);
    }

    // 8. Score final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESUMO FINAL");
    console.log("=".repeat(80));

    let score = 100;
    const issues = [];

    // Calcular score baseado nos problemas
    if (stats.total === 0) {
      score -= 30;
      issues.push("Nenhum paciente cadastrado");
    }
    if (stats.sem_nome > 0) {
      score -= 10;
      issues.push(`${stats.sem_nome} pacientes sem nome`);
    }
    if (stats.sem_valor > 0) {
      score -= 10;
      issues.push(`${stats.sem_valor} pacientes sem valor de sessão`);
    }
    if (duplicates.length > 0) {
      score -= 5;
      issues.push(`${duplicates.length} nomes duplicados`);
    }
    if (orphanPatients[0].count > 0) {
      score -= 15;
      issues.push(`${orphanPatients[0].count} pacientes órfãos`);
    }

    console.log(`\n🎯 SCORE: ${Math.max(0, score)}/100`);

    if (issues.length > 0) {
      console.log("\n⚠️ Problemas identificados:");
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    if (score >= 90) {
      console.log("\n✅ Sistema em excelente estado!");
    } else if (score >= 70) {
      console.log("\n⚠️ Sistema funcional, mas precisa de melhorias");
    } else {
      console.log("\n❌ Sistema com problemas críticos que precisam correção urgente");
    }

    console.log("=" .repeat(80) + "\n");

  } catch (error) {
    console.error("❌ Erro durante análise:", error);
  }
}

// Executar análise
analyzeGiseleData()
  .then(() => {
    console.log("✅ Análise concluída");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });