/**
 * Teste Paralelo do Sistema Ledivan Plus
 * Graph Engineering Testing - Testa múltiplas funcionalidades em paralelo
 */

import { db } from "@/db";
import { users, patients, therapySessions, transactions } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Uma contagem SQL crua, devolvida como número.
 *
 * O formato do retorno de `db.execute` difere entre drivers (uns devolvem `{ rows }`, outros o
 * array direto), e a bateria roda contra o Neon por HTTP. Normalizar aqui evita repetir o mesmo
 * tratamento em nove consultas — e evita que uma delas devolva `undefined` e passe como se fosse
 * zero, que seria um verde falso justamente nas regras que mais importam.
 */
async function conta(consulta: Parameters<typeof db.execute>[0]): Promise<number> {
  const r = (await db.execute(consulta)) as unknown as { rows?: { n: number }[] } | { n: number }[];
  const linha = Array.isArray(r) ? r[0] : r.rows?.[0];
  const n = Number(linha?.n);
  if (!Number.isFinite(n)) throw new Error("a contagem não voltou um número — consulta ou driver mudou");
  return n;
}

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

    /**
     * INVARIANTES, não fotografia da base.
     *
     * Esta bateria conferia nomes de paciente e contagens fixas ("expected: 65") de uma base que
     * foi ZERADA em 30/08/2026. Desde então falhava sempre, e pelo motivo errado: e-mail da
     * terapeuta trocado (`giselebarrossantos@` em vez de `giselesantosbarbosa@`), nome que mudou,
     * conta demo que virou `socrates@`, pacientes que não existem mais. Seis vermelhos constantes
     * não são sinal — são ruído com cara de sinal, e ninguém lia o resultado.
     *
     * O que se afirma aqui agora é o que continua verdade enquanto a terapeuta cadastra: cada dado
     * tem dono, nenhum dono enxerga o do outro, e o domínio só aceita os valores que conhece.
     * Contagem que muda com o uso vira INFORMAÇÃO no relatório, nunca asserção — foi transformar
     * contagem em asserção que matou a bateria da outra vez.
     */
    const tests = await Promise.all([
      // 1. ISOLAMENTO: nenhuma sessão de um terapeuta aponta para paciente de outro.
      //    É a regra mais cara da casa — multi-tenant furado vaza prontuário entre consultórios.
      this.runTest('Isolamento: sessão x dono do paciente', async () => {
        const n = await conta(sql`
          SELECT COUNT(*)::int AS n FROM therapy_sessions s
          JOIN patients p ON p.id = s.patient_id
          WHERE s.user_id <> p.user_id`);
        if (n > 0) throw new Error(`${n} sessões cruzam a fronteira do dono`);
        return { cruzamentos: 0 };
      }),

      // 2. ISOLAMENTO: o mesmo para o dinheiro.
      this.runTest('Isolamento: pagamento x dono do paciente', async () => {
        const n = await conta(sql`
          SELECT COUNT(*)::int AS n FROM session_payments sp
          JOIN patients p ON p.id = sp.patient_id
          WHERE sp.user_id <> p.user_id`);
        if (n > 0) throw new Error(`${n} pagamentos cruzam a fronteira do dono`);
        return { cruzamentos: 0 };
      }),

      // 3. ÓRFÃOS: linha sem dono não aparece em tela nenhuma e não some sozinha.
      this.runTest('Sem órfãos: tudo tem dono', async () => {
        const pacientes = await conta(sql`SELECT COUNT(*)::int AS n FROM patients WHERE user_id IS NULL`);
        const sessoes = await conta(sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE user_id IS NULL`);
        const pagamentos = await conta(sql`SELECT COUNT(*)::int AS n FROM session_payments WHERE user_id IS NULL`);
        const soltos = pacientes + sessoes + pagamentos;
        if (soltos > 0) throw new Error(`${soltos} registros sem dono (pacientes ${pacientes}, sessões ${sessoes}, pagamentos ${pagamentos})`);
        return { orfaos: 0 };
      }),

      // 4. DOMÍNIO: status de sessão dentro do que o app sabe exibir. Um valor estranho não quebra
      //    a tela — ela mostra a string crua — e por isso passaria despercebido.
      this.runTest('Domínio: status de sessão conhecidos', async () => {
        const n = await conta(sql`
          SELECT COUNT(*)::int AS n FROM therapy_sessions
          WHERE status NOT IN ('agendada','realizada','nao_realizada','cancelada','realocada','prof_desmarcou','atestado')`);
        if (n > 0) throw new Error(`${n} sessões com status fora da lista conhecida`);
        return { desconhecidos: 0 };
      }),

      // 5. DOC 45/54: `faltou_conta` só significa alguma coisa quando o status é Faltou. Preenchido
      //    fora disso, é uma resposta órfã esperando para mexer em dinheiro quando o status voltar.
      this.runTest('Doc 54: faltou_conta só em sessão Faltou', async () => {
        const n = await conta(sql`
          SELECT COUNT(*)::int AS n FROM therapy_sessions
          WHERE faltou_conta IS NOT NULL AND status <> 'nao_realizada'`);
        if (n > 0) throw new Error(`${n} sessões com resposta de falta sem estar em Faltou`);
        return { respostasOrfas: 0 };
      }),

      // 6. DOC 54: cortesia só vale em sessão do pacote completo mensal/quinzenal, e nunca numa
      //    sessão extra. Fora disso ela zeraria uma cobrança por uma porta que a tela nem oferece.
      this.runTest('Doc 54: cortesia só em pacote completo', async () => {
        const n = await conta(sql`
          SELECT COUNT(*)::int AS n FROM therapy_sessions s
          JOIN patients p ON p.id = s.patient_id
          WHERE s.cortesia
            AND (p.payment_format NOT IN ('mensal','quinzenal')
                 OR COALESCE(p.pacote_tipo,'completo') = 'fragmentado'
                 OR s.extra IS NOT NULL)`);
        if (n > 0) throw new Error(`${n} cortesias fora da regra do doc 54`);
        return { foraDaRegra: 0 };
      }),

      // 7. DINHEIRO: valor negativo não existe no domínio. Pagamento é entrada; estorno é outra coisa.
      this.runTest('Dinheiro: sem valores negativos', async () => {
        const pagamentos = await conta(sql`SELECT COUNT(*)::int AS n FROM session_payments WHERE amount::numeric < 0`);
        const extras = await conta(sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE valor_extra IS NOT NULL AND valor_extra::numeric < 0`);
        if (pagamentos + extras > 0) throw new Error(`valores negativos: ${pagamentos} pagamentos, ${extras} extras`);
        return { negativos: 0 };
      }),

      // 8. RETRATO da base — INFORMAÇÃO, nunca asserção: estes números mudam a cada cadastro novo,
      //    e foi exatamente transformá-los em asserção que quebrou esta bateria da outra vez.
      this.runTest('Retrato da base (informativo)', async () => {
        const [u, p, s2, t] = await Promise.all([
          db.select().from(users),
          db.select().from(patients),
          db.select().from(therapySessions),
          db.select().from(transactions),
        ]);
        return { terapeutas: u.length, pacientes: p.length, sessoes: s2.length, transacoes: t.length };
      }),

      // 9. PERFORMANCE: quatro consultas em paralelo, como a abertura do dashboard faz.
      this.runTest('Performance das consultas', async () => {
        const start = Date.now();
        await Promise.all([
          db.select().from(users),
          db.select().from(patients),
          db.select().from(therapySessions).limit(100),
          db.select().from(transactions).limit(100),
        ]);
        const elapsed = Date.now() - start;
        return {
          timeMs: elapsed,
          performance: elapsed < 1000 ? 'Excelente' : elapsed < 3000 ? 'Bom' : 'Precisa otimização',
        };
      }),
    ]);
    void tests;

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