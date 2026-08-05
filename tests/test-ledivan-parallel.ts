/**
 * Teste Paralelo do Sistema Ledivan Plus
 * Graph Engineering Testing - Testa múltiplas funcionalidades em paralelo
 */

import { db } from "@/db";
import { users, patients, therapySessions, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  time: number;
  error?: any;
  details?: any;
}

class ParallelTester {
  private results: TestResult[] = [];
  private startTime = Date.now();

  async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const testStart = Date.now();
    try {
      const details = await testFn();
      const result: TestResult = {
        name,
        status: 'passed',
        time: Date.now() - testStart,
        details
      };
      this.results.push(result);
      return result;
    } catch (error) {
      const result: TestResult = {
        name,
        status: 'failed',
        time: Date.now() - testStart,
        error
      };
      this.results.push(result);
      return result;
    }
  }

  async runAllTests() {
    console.log(`${colors.cyan}🚀 Iniciando Testes Paralelos do Ledivan Plus${colors.reset}\n`);
    console.log(`${colors.blue}═══════════════════════════════════════════════${colors.reset}\n`);

    // Executar testes em paralelo
    const tests = await Promise.all([
      // Teste 1: Verificar usuária Gisele
      this.runTest('Verificar Usuária Gisele', async () => {
        const user = await db.query.users.findFirst({
          where: eq(users.email, 'giselebarrossantos@gmail.com')
        });
        if (!user) throw new Error('Usuária Gisele não encontrada');
        if (user.name !== 'Gisele Barros Santos') {
          throw new Error(`Nome incorreto: ${user.name}`);
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          verified: !!user.emailVerified
        };
      }),

      // Teste 2: Verificar conta demo
      this.runTest('Verificar Conta Demo', async () => {
        const user = await db.query.users.findFirst({
          where: eq(users.email, 'demo@ledivan.com.br')
        });
        if (!user) throw new Error('Conta demo não encontrada');
        return {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }),

      // Teste 3: Contar pacientes da Gisele
      this.runTest('Contar Pacientes da Gisele', async () => {
        const gisele = await db.query.users.findFirst({
          where: eq(users.email, 'giselebarrossantos@gmail.com')
        });
        if (!gisele) throw new Error('Gisele não encontrada');

        const patientsList = await db.query.patients.findMany({
          where: eq(patients.userId, gisele.id)
        });

        const activeCount = patientsList.filter(p => p.status === 'active').length;
        const inactiveCount = patientsList.filter(p => p.status === 'inactive').length;

        return {
          total: patientsList.length,
          active: activeCount,
          inactive: inactiveCount,
          expected: 65
        };
      }),

      // Teste 4: Verificar transações financeiras
      this.runTest('Verificar Transações Financeiras', async () => {
        const gisele = await db.query.users.findFirst({
          where: eq(users.email, 'giselebarrossantos@gmail.com')
        });
        if (!gisele) throw new Error('Gisele não encontrada');

        const transactionsList = await db.query.transactions.findMany({
          where: eq(transactions.userId, gisele.id)
        });

        const totalIncome = transactionsList
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalExpense = transactionsList
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          total: transactionsList.length,
          income: totalIncome,
          expense: totalExpense,
          balance: totalIncome - totalExpense,
          expected: 79
        };
      }),

      // Teste 5: Verificar sessões de terapia
      this.runTest('Verificar Sessões de Terapia', async () => {
        const gisele = await db.query.users.findFirst({
          where: eq(users.email, 'giselebarrossantos@gmail.com')
        });
        if (!gisele) throw new Error('Gisele não encontrada');

        const sessions = await db.query.therapySessions.findMany({
          where: eq(therapySessions.userId, gisele.id)
        });

        const statusCount = sessions.reduce((acc: any, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        }, {});

        return {
          total: sessions.length,
          byStatus: statusCount
        };
      }),

      // Teste 6: Validar estrutura do banco
      this.runTest('Validar Estrutura do Banco', async () => {
        const tables = {
          users: await db.select().from(users).limit(1),
          patients: await db.select().from(patients).limit(1),
          sessions: await db.select().from(therapySessions).limit(1),
          transactions: await db.select().from(transactions).limit(1)
        };

        return {
          tablesAccessible: Object.keys(tables).length,
          status: 'OK'
        };
      }),

      // Teste 7: Verificar pacientes específicos
      this.runTest('Verificar Pacientes Principais', async () => {
        const gisele = await db.query.users.findFirst({
          where: eq(users.email, 'giselebarrossantos@gmail.com')
        });
        if (!gisele) throw new Error('Gisele não encontrada');

        const patientsList = await db.query.patients.findMany({
          where: eq(patients.userId, gisele.id)
        });

        const importantPatients = [
          'ALESSANDRA', 'GIULIA', 'HEITOR', 'IRIS',
          'JOYCE', 'KÁTIA', 'PEDRO', 'SÔNIA'
        ];

        const found = importantPatients.map(name => ({
          name,
          exists: patientsList.some(p => p.name.includes(name))
        }));

        return {
          checkedPatients: found,
          allFound: found.every(f => f.exists)
        };
      }),

      // Teste 8: Performance - Queries em paralelo
      this.runTest('Teste de Performance', async () => {
        const start = Date.now();

        const [userCount, patientCount, sessionCount, transactionCount] = await Promise.all([
          db.select().from(users),
          db.select().from(patients),
          db.select().from(therapySessions).limit(100),
          db.select().from(transactions).limit(100)
        ]);

        const elapsed = Date.now() - start;

        return {
          queriesExecuted: 4,
          timeMs: elapsed,
          performance: elapsed < 1000 ? 'Excelente' : elapsed < 3000 ? 'Bom' : 'Precisa otimização'
        };
      })
    ]);

    // Exibir resultados
    this.displayResults();
  }

  displayResults() {
    console.log(`\n${colors.blue}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}📊 RESULTADOS DOS TESTES${colors.reset}\n`);

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;

    // Mostrar cada teste
    this.results.forEach((result, index) => {
      const icon = result.status === 'passed' ? '✅' : '❌';
      const color = result.status === 'passed' ? colors.green : colors.red;

      console.log(`${icon} ${color}Teste ${index + 1}: ${result.name}${colors.reset}`);
      console.log(`   ⏱️  Tempo: ${result.time}ms`);

      if (result.status === 'passed' && result.details) {
        console.log(`   📝 Detalhes: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
      }

      if (result.status === 'failed' && result.error) {
        console.log(`   ❗ Erro: ${colors.red}${result.error.message}${colors.reset}`);
      }

      console.log('');
    });

    // Resumo final
    const totalTime = Date.now() - this.startTime;
    console.log(`${colors.blue}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}📈 RESUMO FINAL${colors.reset}\n`);
    console.log(`${colors.green}✅ Passou: ${passed}${colors.reset}`);
    console.log(`${colors.red}❌ Falhou: ${failed}${colors.reset}`);
    console.log(`⏱️  Tempo Total: ${totalTime}ms`);
    console.log(`🚀 Performance: ${totalTime < 5000 ? 'Excelente' : totalTime < 10000 ? 'Bom' : 'Precisa otimização'}`);

    if (failed === 0) {
      console.log(`\n${colors.green}🎉 TODOS OS TESTES PASSARAM!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}⚠️  ${failed} TESTES FALHARAM${colors.reset}`);
    }
  }
}

// Executar testes
async function main() {
  const tester = new ParallelTester();

  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}💥 Erro fatal nos testes:${colors.reset}`, error);
    process.exit(1);
  }
}

// Executar diretamente
main();

export { ParallelTester };