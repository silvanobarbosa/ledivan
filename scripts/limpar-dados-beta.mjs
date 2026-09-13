/**
 * LIMPEZA PARA UMA NOVA LEVA DE TESTES.
 *
 * As duas beta testers vão recomeçar os testes do zero. O pedido é cirúrgico: **apagar os dados,
 * manter as configurações**. As duas coisas não estão separadas no schema, então a separação é
 * feita aqui, explicitamente, e vale a pena dizer qual é:
 *
 * - **Configuração** é o que a terapeuta ajustou para si: os locais de atendimento, as cidades de
 *   feriado, o SMTP, o WhatsApp, a mensagem de aniversário, o slug de agendamento, a chave de IA,
 *   o termo de consentimento modelo, as contas e categorias do financeiro. Nada disso é tocado.
 * - **Dado** é tudo que nasceu de um paciente: o cadastro dele e todo o rastro (sessões, prontuário,
 *   pagamentos, humor, escalas, documentos, mensagens enviadas).
 *
 * Duas travas, porque isto é irreversível:
 * 1. Só roda nos dois ids listados em ALVOS. A demo do Dr. Sócrates e a conta do dono ficam fora
 *    por construção — não é filtro, é lista.
 * 2. Sem `--executar` o script só CONTA. E mesmo com `--executar`, grava antes um backup JSON de
 *    tudo que vai sumir.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import { mkdirSync, writeFileSync } from "node:fs";

const sql = neon(process.env.DATABASE_URL);
const EXECUTAR = process.argv.includes("--executar");

/** Lista fechada, nunca um filtro. Conta que não está aqui não corre risco nenhum. */
const ALVOS = [
  { id: "usr_1c9da6c087bb9441e7bf", email: "giselesantosbarbosa@gmail.com" },
  { id: "usr_f5063de6c54a05be615e", email: "ana.raquel.bassi2020@gmail.com" },
];

/**
 * Quem sai, e por onde se chega nele. A ordem importa: filho antes de pai, senão a chave
 * estrangeira barra o delete.
 */
const PELO_PACIENTE = [
  "session_ratings",
  "session_payments",
  "therapy_sessions",
  "patient_records",
  "patient_diary",
  "patient_writing",
  "patient_daily_status",
  "patient_document",
  "patient_consents",
  "patient_auth_code",
  "patient_price_history",
  "patient_contract_history",
  "patient_status_history",
  "patient_packages",
  "prospect_contacts",
  "treatment_goals",
  "scale_applications",
  "assignments",
  "mood_logs",
  "messages",
  "message_log",
  "push_tokens",
];

/** Movimento do financeiro nasce do atendimento; a conta e a categoria onde ele cai, não. */
const PELA_CONTA = ["transactions"];

const backup = {};
/** O que apagar, na ordem. Enche primeiro, executa depois — assim o backup é gravado antes. */
const apagar = [];

for (const alvo of ALVOS) {
  console.log(`\n── ${alvo.email} ──`);

  const pacientes = await sql.query(`SELECT id, name FROM patients WHERE user_id = $1`, [alvo.id]);
  const ids = pacientes.map((p) => p.id);
  console.log(`  ${ids.length} paciente(s)`);

  if (ids.length === 0) {
    console.log("  nada a limpar");
    continue;
  }

  for (const tabela of PELO_PACIENTE) {
    const linhas = await sql.query(`SELECT * FROM "${tabela}" WHERE patient_id = ANY($1)`, [ids]);
    if (linhas.length === 0) continue;
    console.log(`  ${tabela.padEnd(26)} ${linhas.length}`);
    backup[`${alvo.email}/${tabela}`] = linhas;
    apagar.push({ tabela, sql: `DELETE FROM "${tabela}" WHERE patient_id = ANY($1)`, args: [ids] });
  }

  for (const tabela of PELA_CONTA) {
    const linhas = await sql.query(`SELECT * FROM "${tabela}" WHERE user_id = $1`, [alvo.id]);
    if (linhas.length === 0) continue;
    console.log(`  ${tabela.padEnd(26)} ${linhas.length}`);
    backup[`${alvo.email}/${tabela}`] = linhas;
    apagar.push({ tabela, sql: `DELETE FROM "${tabela}" WHERE user_id = $1`, args: [alvo.id] });
  }

  console.log(`  ${"patients".padEnd(26)} ${pacientes.length}`);
  backup[`${alvo.email}/patients`] = pacientes;
  apagar.push({ tabela: "patients", sql: `DELETE FROM patients WHERE user_id = $1`, args: [alvo.id] });
}

if (!EXECUTAR) {
  console.log("\nEnsaio. Nada foi apagado. Rode com --executar para valer.");
  process.exit(0);
}

// O backup vai para o disco ANTES do primeiro delete. Gravar depois seria gravar o que sobrou.
mkdirSync("backups", { recursive: true });
const arquivo = `backups/beta-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(arquivo, JSON.stringify(backup, null, 2));
console.log(`\nbackup gravado: ${arquivo}`);

for (const passo of apagar) {
  await sql.query(passo.sql, passo.args);
  console.log(`  apagado ${passo.tabela}`);
}

console.log("\nLimpeza feita. As configurações das contas não foram tocadas.");
