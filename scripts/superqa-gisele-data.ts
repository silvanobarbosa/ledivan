import { db } from "../src/db";
import { users, patients, therapySessions, therapistFinancialGoals, transactions } from "../src/db/schema";
import { eq, sql, and, desc } from "drizzle-orm";

interface QAResult {
  category: string;
  status: "✅ OK" | "⚠️ Aviso" | "❌ Erro";
  message: string;
  details?: any;
  action?: string;
}

async function analyzeGiseleData() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 SUPERQA - ANÁLISE COMPLETA DOS DADOS DA GISELE");
  console.log("=".repeat(80));

  const results: QAResult[] = [];
  let score = 100;

  try {
    // 1. Verificar dados do usuário Gisele
    console.log("\n📊 1. DADOS DO USUÁRIO");
    const giseleUser = await db.query.users.findFirst({
      where: eq(users.email, "giselebarrossantos@gmail.com")
    });

    if (!giseleUser) {
      results.push({
        category: "Usuário",
        status: "❌ Erro",
        message: "Usuário Gisele não encontrado",
        action: "Criar usuário com dados corretos"
      });
      score -= 20;
    } else {
      console.log("✅ Usuário encontrado:");
      console.log(`   - ID: ${giseleUser.id}`);
      console.log(`   - Nome: ${giseleUser.name}`);
      console.log(`   - Email: ${giseleUser.email}`);
      console.log(`   - Role: ${giseleUser.role}`);

      // Verificar campos importantes
      if (giseleUser.name !== "Gisele Barros Santos") {
        results.push({
          category: "Usuário",
          status: "⚠️ Aviso",
          message: `Nome incorreto: "${giseleUser.name}" (deveria ser "Gisele Barros Santos")`,
          action: "Atualizar nome do usuário"
        });
        score -= 5;
      }

      if (!giseleUser.googleCalendarConnected) {
        results.push({
          category: "Integração",
          status: "⚠️ Aviso",
          message: "Google Calendar não conectado",
          action: "Configurar integração com Google Calendar"
        });
      }
    }

    // 2. Analisar pacientes
    console.log("\n📊 2. ANÁLISE DE PACIENTES");
    const allPatients = await db.query.patients.findMany({
      where: eq(patients.userId, giseleUser?.id || "")
    });

    console.log(`   Total de pacientes: ${allPatients.length}`);

    if (allPatients.length === 0) {
      results.push({
        category: "Pacientes",
        status: "❌ Erro",
        message: "Nenhum paciente cadastrado",
        action: "Importar dados da planilha"
      });
      score -= 20;
    } else {
      // Análise detalhada dos pacientes
      const stats = {
        ativos: 0,
        inativos: 0,
        semNome: 0,
        semEmail: 0,
        semTelefone: 0,
        semValorSessao: 0,
        semTipoAtendimento: 0,
        duplicados: new Map<string, number>()
      };

      for (const patient of allPatients) {
        // Status
        if (patient.status === "ativo") stats.ativos++;
        else stats.inativos++;

        // Campos vazios
        if (!patient.name || patient.name.trim() === "") stats.semNome++;
        if (!patient.email || patient.email.trim() === "") stats.semEmail++;
        if (!patient.phone || patient.phone.trim() === "") stats.semTelefone++;
        if (!patient.sessionValue || patient.sessionValue <= 0) stats.semValorSessao++;
        if (!patient.paymentType) stats.semTipoAtendimento++;

        // Verificar duplicados
        const key = patient.name?.toLowerCase().trim() || "";
        if (key) {
          stats.duplicados.set(key, (stats.duplicados.get(key) || 0) + 1);
        }
      }

      console.log(`   - Ativos: ${stats.ativos}`);
      console.log(`   - Inativos: ${stats.inativos}`);
      console.log(`   - Sem nome: ${stats.semNome}`);
      console.log(`   - Sem email: ${stats.semEmail}`);
      console.log(`   - Sem telefone: ${stats.semTelefone}`);
      console.log(`   - Sem valor de sessão: ${stats.semValorSessao}`);
      console.log(`   - Sem tipo de atendimento: ${stats.semTipoAtendimento}`);

      // Reportar problemas
      if (stats.semNome > 0) {
        results.push({
          category: "Pacientes",
          status: "❌ Erro",
          message: `${stats.semNome} paciente(s) sem nome`,
          action: "Preencher nomes faltantes"
        });
        score -= 10;
      }

      if (stats.semValorSessao > 0) {
        results.push({
          category: "Pacientes",
          status: "⚠️ Aviso",
          message: `${stats.semValorSessao} paciente(s) sem valor de sessão`,
          action: "Definir valores de sessão"
        });
        score -= 5;
      }

      // Verificar duplicados
      const duplicados = Array.from(stats.duplicados.entries())
        .filter(([_, count]) => count > 1);

      if (duplicados.length > 0) {
        results.push({
          category: "Pacientes",
          status: "⚠️ Aviso",
          message: `${duplicados.length} nome(s) duplicado(s) encontrado(s)`,
          details: duplicados.map(([nome, count]) => `${nome} (${count}x)`),
          action: "Verificar e corrigir duplicados"
        });
        score -= 5;
      }
    }

    // 3. Analisar sessões
    console.log("\n📊 3. ANÁLISE DE SESSÕES");
    const sessions = await db.query.therapySessions.findMany({
      where: eq(therapySessions.userId, giseleUser?.id || ""),
      orderBy: desc(therapySessions.date)
    });

    console.log(`   Total de sessões: ${sessions.length}`);

    if (sessions.length === 0) {
      results.push({
        category: "Sessões",
        status: "⚠️ Aviso",
        message: "Nenhuma sessão registrada",
        action: "Começar a registrar sessões"
      });
    } else {
      // Análise de status das sessões
      const sessionStats = {
        confirmada: 0,
        pendente: 0,
        cancelada: 0,
        falta: 0,
        outros: 0
      };

      for (const session of sessions) {
        const status = session.status || "outros";
        if (status === "confirmada") sessionStats.confirmada++;
        else if (status === "pendente") sessionStats.pendente++;
        else if (status === "cancelada") sessionStats.cancelada++;
        else if (status === "falta") sessionStats.falta++;
        else sessionStats.outros++;
      }

      console.log(`   - Confirmadas: ${sessionStats.confirmada}`);
      console.log(`   - Pendentes: ${sessionStats.pendente}`);
      console.log(`   - Canceladas: ${sessionStats.cancelada}`);
      console.log(`   - Faltas: ${sessionStats.falta}`);
    }

    // 4. Analisar finanças
    console.log("\n📊 4. ANÁLISE FINANCEIRA");
    const transactionList = await db.query.transactions.findMany({
      where: eq(transactions.userId, giseleUser?.id || "")
    });

    console.log(`   Total de transações: ${transactionList.length}`);

    if (transactionList.length === 0) {
      results.push({
        category: "Finanças",
        status: "⚠️ Aviso",
        message: "Nenhuma transação registrada",
        action: "Começar a registrar receitas e despesas"
      });
    } else {
      const receitas = transactionList.filter(t => t.type === "receita");
      const despesas = transactionList.filter(t => t.type === "despesa");
      const totalReceitas = receitas.reduce((sum, t) => sum + (t.value || 0), 0);
      const totalDespesas = despesas.reduce((sum, t) => sum + (t.value || 0), 0);

      console.log(`   - Receitas: ${receitas.length} (R$ ${totalReceitas.toFixed(2)})`);
      console.log(`   - Despesas: ${despesas.length} (R$ ${totalDespesas.toFixed(2)})`);
      console.log(`   - Saldo: R$ ${(totalReceitas - totalDespesas).toFixed(2)}`);
    }

    // 5. Verificar integridade dos dados
    console.log("\n📊 5. INTEGRIDADE DOS DADOS");

    // Verificar se há pacientes sem ID de usuário
    const orphanPatients = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM patients
      WHERE user_id IS NULL OR user_id = ''
    `);

    if (orphanPatients.rows[0]?.count > 0) {
      results.push({
        category: "Integridade",
        status: "❌ Erro",
        message: `${orphanPatients.rows[0].count} paciente(s) órfão(s) encontrado(s)`,
        action: "Vincular pacientes ao usuário correto"
      });
      score -= 15;
    }

    // 6. Verificar dados da planilha
    console.log("\n📊 6. ANÁLISE DE IMPORTAÇÃO DA PLANILHA");

    // Buscar pacientes com possíveis problemas de importação
    const problemPatients = allPatients.filter(p => {
      return (
        // Nome em caixa alta (indica importação direta)
        p.name === p.name?.toUpperCase() ||
        // Campos críticos vazios
        !p.paymentType ||
        !p.sessionValue ||
        // Email genérico ou inválido
        p.email?.includes("@example.com") ||
        !p.email?.includes("@")
      );
    });

    if (problemPatients.length > 0) {
      results.push({
        category: "Importação",
        status: "⚠️ Aviso",
        message: `${problemPatients.length} paciente(s) com possíveis problemas de importação`,
        details: problemPatients.slice(0, 5).map(p => p.name),
        action: "Revisar e corrigir dados importados"
      });
      score -= 10;
    }

    // Gerar relatório final
    console.log("\n" + "=".repeat(80));
    console.log("📋 RELATÓRIO FINAL");
    console.log("=".repeat(80));

    // Agrupar por status
    const erros = results.filter(r => r.status === "❌ Erro");
    const avisos = results.filter(r => r.status === "⚠️ Aviso");
    const oks = results.filter(r => r.status === "✅ OK");

    if (erros.length > 0) {
      console.log("\n❌ ERROS CRÍTICOS:");
      for (const erro of erros) {
        console.log(`   - [${erro.category}] ${erro.message}`);
        if (erro.action) console.log(`     → Ação: ${erro.action}`);
        if (erro.details) console.log(`     Detalhes: ${JSON.stringify(erro.details)}`);
      }
    }

    if (avisos.length > 0) {
      console.log("\n⚠️ AVISOS:");
      for (const aviso of avisos) {
        console.log(`   - [${aviso.category}] ${aviso.message}`);
        if (aviso.action) console.log(`     → Ação: ${aviso.action}`);
        if (aviso.details) console.log(`     Detalhes: ${JSON.stringify(aviso.details)}`);
      }
    }

    // Score final
    console.log("\n" + "=".repeat(80));
    console.log(`🎯 SCORE FINAL: ${Math.max(0, score)}/100`);

    if (score >= 90) {
      console.log("✅ Sistema em excelente estado!");
    } else if (score >= 70) {
      console.log("⚠️ Sistema funcional, mas precisa de melhorias");
    } else {
      console.log("❌ Sistema com problemas críticos que precisam ser corrigidos");
    }

    console.log("=".repeat(80) + "\n");

    // Retornar dados para possível correção
    return {
      score,
      results,
      userData: giseleUser,
      patients: allPatients,
      stats: {
        totalPatients: allPatients.length,
        totalSessions: sessions.length,
        totalTransactions: transactionList.length
      }
    };

  } catch (error) {
    console.error("❌ Erro durante análise:", error);
    return null;
  }
}

// Executar análise
analyzeGiseleData()
  .then(result => {
    if (result && result.score < 70) {
      console.log("\n🔧 Iniciando correções automáticas...\n");
      // Aqui podemos adicionar correções automáticas se necessário
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("Erro fatal:", err);
    process.exit(1);
  });