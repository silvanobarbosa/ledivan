/**
 * Script COMPLETO de importação dos dados da Gisele
 * Planilha: Financeiro 040826.xlsx
 *
 * Importa:
 * - Pacientes (da aba "Financ Cobranças")
 * - Sessões/Agendas (da aba "Financ Cobranças")
 * - Pagamentos (da aba "Financ entradas")
 */

import { db } from '../src/db';
import { patients, therapySessions, payments, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
const XLSX = require('xlsx');

const TENANT_ID = 'UCSVD3kGckdti5s9amrfMV8CadF2FIwY'; // Gisele

// Nomes que são despesas/outros (não pacientes)
const NAO_PACIENTES = new Set([
  'Academia', 'Botox', 'Bolo Gi', 'Capoeira', 'Cartão', 'Ceclin',
  'Congresso', 'Custo fixo', 'Dentista Heitor', 'Depilação',
  'Devolução Amazon', 'Diferença', 'Diferença:', 'Doação Obreiros',
  'Débito', 'Entrada Diversos', 'Entrada Pontos Cartão', 'Entradas div',
  'Estacionamento', 'Exame', 'Festa Vini', 'Heitor escola', 'IPTU',
  'Investimento', 'Manutenção', 'Matricula Heitor', 'Mercado',
  'Multas', 'Pagamentos', 'Pedicure', 'Pix enviado diversos',
  'Placa dentista', 'Present Cris', 'Present EU', 'Present Silvano',
  'Presente Felipe', 'Presente Laura', 'Presente Paty', 'Presente Rafa',
  'Pós', 'RNTP', 'Remédios', 'Sala', 'Supervisão', 'Terapia',
  'Terapia Heitor', 'Uber', 'Vereda', 'entrada Heitor'
]);

interface PacienteData {
  nome: string;
  diaAtendimento?: string;
  horario?: string;
  frequencia?: string;
  dataNascimento?: Date;
  dataInicio?: Date;
  validadePreco?: string;
  valorSessao?: number;
  tipoFechamento?: string;
  totalHoras?: number;
  pacotes: Array<{
    dataPagamento?: Date;
    qtdSessoes?: number;
    valorTotal?: number;
  }>;
  sessoes: Array<{
    data?: Date;
    presenca: number;  // 0=ausente, 1=presente
    cobranca: string;  // s=pago, n=nao_cobra, d=devedor
  }>;
}

function normalizarNome(nome: string): string {
  if (!nome) return '';
  // Normalizar: primeira letra maiúscula, resto minúsculo
  return nome
    .trim()
    .split(' ')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function isPaciente(nome: string): boolean {
  const norm = normalizarNome(nome);
  if (NAO_PACIENTES.has(nome)) return false;
  if (NAO_PACIENTES.has(norm)) return false;

  // Se tem apenas letras e espaços, provavelmente é paciente
  return /^[A-Za-zÀ-ÿ\s]+$/.test(norm) && norm.length > 2;
}

async function main() {
  console.log('🔄 Iniciando importação COMPLETA dos dados da Gisele...\n');

  const filePath = 'C:/Users/User/Ledivan Plus/Gi/Financeiro 040826.xlsx';
  const workbook = XLSX.readFile(filePath);

  // Verificar se usuário/tenant existe
  const [user] = await db.select().from(users).where(eq(users.id, TENANT_ID)).limit(1);
  if (!user) {
    throw new Error(`Usuário ${TENANT_ID} não encontrado!`);
  }

  console.log(`✅ Usuário encontrado: ${user.name} (${user.email})\n`);

  // ===========================================================================
  // PASSO 1: Ler aba "Financ Cobranças" (pacientes + sessões)
  // ===========================================================================

  console.log('📊 PASSO 1: Lendo aba "Financ Cobranças"...');
  const ws1 = workbook.Sheets[workbook.SheetNames[0]];

  const pacientesMap = new Map<string, PacienteData>();

  // Linha 4 = nomes dos pacientes
  // Cada paciente ocupa ~4 colunas (nome, presença, cobrança, vazio)
  const range = XLSX.utils.decode_range(ws1['!ref']);

  for (let col = 0; col <= range.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: col }); // linha 4 = row 3 (0-indexed)
    const cell = ws1[cellRef];

    if (cell && cell.v) {
      const nome = String(cell.v).trim();

      if (isPaciente(nome)) {
        const nomeNorm = normalizarNome(nome);

        if (!pacientesMap.has(nomeNorm)) {
          console.log(`  📝 Encontrado paciente: ${nomeNorm} (coluna ${col + 1})`);

          pacientesMap.set(nomeNorm, {
            nome: nomeNorm,
            pacotes: [],
            sessoes: []
          });

          // Ler dados básicos do paciente (linhas 5-18)
          const colPaciente = col;

          // Linha 5: Dia de atendimento
          const diaCell = ws1[XLSX.utils.encode_cell({ r: 4, c: colPaciente })];
          if (diaCell) pacientesMap.get(nomeNorm)!.diaAtendimento = String(diaCell.v);

          // Linha 6: Horário
          const horarioCell = ws1[XLSX.utils.encode_cell({ r: 5, c: colPaciente })];
          if (horarioCell) pacientesMap.get(nomeNorm)!.horario = String(horarioCell.v);

          // Linha 7: Frequência
          const freqCell = ws1[XLSX.utils.encode_cell({ r: 6, c: colPaciente })];
          if (freqCell) pacientesMap.get(nomeNorm)!.frequencia = String(freqCell.v);

          // Linha 8: Data Nascimento
          const nascCell = ws1[XLSX.utils.encode_cell({ r: 7, c: colPaciente })];
          if (nascCell && nascCell.v) {
            try {
              const date = XLSX.SSF.parse_date_code(nascCell.v);
              pacientesMap.get(nomeNorm)!.dataNascimento = new Date(date.y, date.m - 1, date.d);
            } catch (e) {
              // Ignorar erro de data
            }
          }

          // Linha 9: Início
          const inicioCell = ws1[XLSX.utils.encode_cell({ r: 8, c: colPaciente })];
          if (inicioCell && inicioCell.v) {
            try {
              const date = XLSX.SSF.parse_date_code(inicioCell.v);
              pacientesMap.get(nomeNorm)!.dataInicio = new Date(date.y, date.m - 1, date.d);
            } catch (e) {
              // Ignorar
            }
          }

          // Linha 11: Valor por sessão
          const valorCell = ws1[XLSX.utils.encode_cell({ r: 10, c: colPaciente })];
          if (valorCell && typeof valorCell.v === 'number') {
            pacientesMap.get(nomeNorm)!.valorSessao = valorCell.v;
          }

          // Linha 12: Tipo de fechamento
          const tipoCell = ws1[XLSX.utils.encode_cell({ r: 11, c: colPaciente })];
          if (tipoCell) pacientesMap.get(nomeNorm)!.tipoFechamento = String(tipoCell.v);

          // Linha 13: Total Horas
          const horasCell = ws1[XLSX.utils.encode_cell({ r: 12, c: colPaciente })];
          if (horasCell && typeof horasCell.v === 'number') {
            pacientesMap.get(nomeNorm)!.totalHoras = horasCell.v;
          }

          // TODO: Ler pacotes (linhas 15-18)
          // TODO: Ler sessões (linhas 33+)
        }
      }
    }
  }

  console.log(`\n✅ Total de pacientes encontrados: ${pacientesMap.size}\n`);

  // ===========================================================================
  // PASSO 2: Ler aba "Financ entradas" (pagamentos)
  // ===========================================================================

  console.log('💰 PASSO 2: Lendo aba "Financ entradas"...');
  const ws2 = workbook.Sheets[workbook.SheetNames[1]];
  const range2 = XLSX.utils.decode_range(ws2['!ref']);

  const pagamentosLista: Array<{
    data: Date;
    paciente: string;
    valor: number;
  }> = [];

  // Estrutura: cada grupo de 4 colunas = 1 mês
  // Col 1: Data, Col 2-4: Nome + Valor (múltiplos pagamentos no mesmo mês)
  for (let col = 0; col <= range2.e.c; col += 4) {
    const dataCell = ws2[XLSX.utils.encode_cell({ r: 0, c: col })];

    if (dataCell && dataCell.v) {
      let dataMes: Date;

      try {
        const parsed = XLSX.SSF.parse_date_code(dataCell.v);
        dataMes = new Date(parsed.y, parsed.m - 1, parsed.d);

        console.log(`  📅 Processando mês: ${dataMes.toISOString().slice(0, 7)} (col ${col + 1})`);

        // Percorrer linhas deste mês
        for (let row = 1; row <= range2.e.r; row++) {
          const nomeCell = ws2[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
          const valorCell = ws2[XLSX.utils.encode_cell({ r: row, c: col + 2 })];

          if (nomeCell && valorCell && typeof valorCell.v === 'number') {
            const nome = normalizarNome(String(nomeCell.v));
            const valor = valorCell.v;

            if (isPaciente(nome) && valor > 0) {
              pagamentosLista.push({
                data: dataMes,
                paciente: nome,
                valor: valor
              });
            }
          }
        }
      } catch (e) {
        // Não é uma data válida, pular
      }
    }
  }

  console.log(`\n✅ Total de pagamentos encontrados: ${pagamentosLista.length}\n`);

  // ===========================================================================
  // PASSO 3: IMPORTAR NO BANCO
  // ===========================================================================

  console.log('💾 PASSO 3: Importando dados no banco...\n');

  // Limpar dados antigos
  console.log('🗑️  Limpando dados antigos...');
  await db.delete(payments).where(eq(payments.userId, TENANT_ID));
  await db.delete(therapySessions).where(eq(therapySessions.userId, TENANT_ID));
  await db.delete(patients).where(eq(patients.userId, TENANT_ID));
  console.log('✅ Dados antigos removidos\n');

  // Criar pacientes
  console.log('👥 Criando pacientes...');
  const pacientesCreated = new Map<string, string>(); // nome -> id

  for (const [nome, data] of pacientesMap.entries()) {
    const [patient] = await db.insert(patients).values({
      userId: TENANT_ID,
      name: nome,
      birthDate: data.dataNascimento || null,
      startDate: data.dataInicio || new Date(),
      frequency: data.frequencia || '1x semana',
      price: data.valorSessao || 200,
      priceValidUntil: data.dataInicio ? new Date(data.dataInicio.getFullYear() + 1, data.dataInicio.getMonth(), data.dataInicio.getDate()) : null,
      contractLabel: data.tipoFechamento || 'avulso',
      notes: data.diaAtendimento && data.horario ? `${data.diaAtendimento} às ${data.horario}` : null,
      status: 'active',
      createdAt: new Date()
    }).returning();

    pacientesCreated.set(nome, patient.id);
    console.log(`  ✅ ${nome} (${patient.id})`);
  }

  console.log(`\n✅ ${pacientesCreated.size} pacientes criados\n`);

  // Criar pagamentos
  console.log('💰 Criando pagamentos...');
  let paymentsCount = 0;

  for (const pag of pagamentosLista) {
    const patientId = pacientesCreated.get(pag.paciente);
    if (patientId) {
      await db.insert(payments).values({
        userId: TENANT_ID,
        patientId: patientId,
        date: pag.data,
        amount: pag.valor.toString(),
        method: 'pix',
        status: 'paid',
        description: `Pagamento ${pag.data.toISOString().slice(0, 7)}`,
        createdAt: new Date()
      });
      paymentsCount++;
    }
  }

  console.log(`✅ ${paymentsCount} pagamentos criados\n`);

  // TODO: Criar sessões (preciso analisar melhor onde ficam as datas das sessões)

  console.log('=' * 80);
  console.log('✅ IMPORTAÇÃO CONCLUÍDA!');
  console.log('=' * 80);
  console.log(`\nResumo:`);
  console.log(`  - Pacientes: ${pacientesCreated.size}`);
  console.log(`  - Pagamentos: ${paymentsCount}`);
  console.log(`  - Sessões: 0 (TODO: preciso localizar as datas das sessões na planilha)`);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro na importação:', err);
  process.exit(1);
});
