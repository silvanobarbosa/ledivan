import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';

const filePath = 'C:/Users/User/Ledivan Plus/Gi/Financeiro 040826.xlsx';
console.log('📊 Analisando planilha:', filePath);
console.log('');

const workbook = XLSX.readFile(filePath);
console.log('📑 Abas encontradas:', workbook.SheetNames.length);
console.log('');

// Listar primeiras 20 abas para entender estrutura
console.log('🔍 Estrutura das primeiras 20 abas:');
workbook.SheetNames.slice(0, 20).forEach((sheetName, idx) => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  const nonEmptyRows = data.filter((row: any) => row && row.length > 0);

  // Pegar header (primeira linha não vazia)
  const header = nonEmptyRows[0] || [];

  console.log(`\n${idx + 1}. "${sheetName}"`);
  console.log(`   Linhas: ${nonEmptyRows.length}`);
  console.log(`   Colunas: ${header.length}`);
  console.log(`   Header: ${JSON.stringify(header.slice(0, 10))}`);
});

console.log('\n\n📋 Total de abas:', workbook.SheetNames.length);
console.log('\n🔍 Listando TODAS as abas:');
workbook.SheetNames.forEach((name, i) => {
  console.log(`${i + 1}. ${name}`);
});
