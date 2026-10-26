/**
 * LIMPEZA DA BASE DE UMA TERAPEUTA — apaga o que foi LANÇADO, preserva a conta.
 *
 * O dono pede isto entre rodadas de teste: a Gisele monta os cenários, usa o app, nós ajustamos, e
 * ela recomeça a avaliação com a base limpa. "Apagar a base" aqui NÃO inclui a conta dela nem as
 * preferências — ela precisa continuar entrando e com o app configurado do jeito dela.
 *
 * É IRREVERSÍVEL. Rode primeiro sem `--apagar` (ensaio) e confira os números; e nunca sem um branch
 * de backup no Neon, que é a diferença entre um susto e um dia perdido.
 *
 *   node scripts/limpar-base-terapeuta.mjs                            # ensaio: só conta
 *   node scripts/limpar-base-terapeuta.mjs --apagar                   # executa
 *   LIMPAR_EMAIL=outra@email node scripts/limpar-base-terapeuta.mjs   # outra conta
 *
 * ANTES de rodar com `--apagar`, crie o branch de backup no Neon. O projeto é `LividanPlus`
 * (`square-river-49620558`) — o nome está escrito com "i", e por isso NÃO aparece numa busca por
 * "ledivan"; procurar pelo nome certo e não achar já custou tempo aqui. Os backups anteriores
 * estão lá, um por limpeza, nomeados pela data.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const EMAIL = process.env.LIMPAR_EMAIL ?? "giselesantosbarbosa@gmail.com";
const APAGAR = process.argv.includes("--apagar");
const sql = neon(process.env.DATABASE_URL);

const [u] = await sql`SELECT id, name, email FROM "user" WHERE email = ${EMAIL}`;
if (!u) { console.error(`Usuário ${EMAIL} não encontrado — nada feito.`); process.exit(1); }
console.log(`${APAGAR ? "APAGANDO" : "ENSAIO (nada será apagado)"} — ${u.name} <${u.email}>\n`);

/**
 * A ordem importa: as filhas antes das mães.
 *
 * Quase tudo pendura em `patients` por CASCADE, mas não dá para confiar nisso em silêncio — uma
 * tabela sem a regra deixaria linhas órfãs, invisíveis em toda tela e eternas no banco. Então cada
 * uma é apagada por nome, e o relatório final prova que sobrou zero.
 */
const PORPACIENTE = [
  "patient_contract_history", "patient_package_history", "patient_payment_format_history",
  "patient_price_history", "patient_status_history",
];
const PORUSUARIO = [
  "cobranca_envios", "cobranca_vencimentos", "patient_credits", "session_payments",
  "sessoes_puladas", "therapy_sessions", "assignments", "mood_logs", "scale_applications",
  "session_ratings", "patient_records", "patient_diary", "patient_writing", "patient_activities",
  "patient_daily_status", "patient_anamnese", "patient_consents", "patient_documents",
  "patient_document", "patient_packages", "patient_reajuste_changes", "treatment_goals",
  "messages", "message_log", "outbound_reminders", "blocked_slots", "transactions",
  "despesas", "receitas_pessoais", "patients",
];

const conta = async (t, porPaciente) => {
  const r = porPaciente
    ? await sql.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE patient_id IN (SELECT id FROM patients WHERE user_id = $1)`, [u.id])
    : await sql.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE user_id = $1`, [u.id]);
  return r[0].n;
};

let total = 0;
for (const [lista, porPaciente] of [[PORPACIENTE, true], [PORUSUARIO, false]]) {
  for (const t of lista) {
    let n;
    try { n = await conta(t, porPaciente); } catch { continue; } // tabela que não existe nesta base
    if (!n) continue;
    total += n;
    console.log(`  ${String(n).padStart(5)}  ${t}`);
    if (APAGAR) {
      if (porPaciente) await sql.query(`DELETE FROM "${t}" WHERE patient_id IN (SELECT id FROM patients WHERE user_id = $1)`, [u.id]);
      else await sql.query(`DELETE FROM "${t}" WHERE user_id = $1`, [u.id]);
    }
  }
}
console.log(`\n  ${total} linhas ${APAGAR ? "apagadas" : "a apagar"}`);

// A conta FICA. É o ponto todo: ela entra amanhã e o app está configurado do jeito dela.
const [depois] = await sql`SELECT id, name, email, preferences IS NOT NULL AS tem_preferencias FROM "user" WHERE email = ${EMAIL}`;
console.log(`\n  conta preservada: ${depois ? "sim" : "NÃO — isso é um defeito"} ${depois?.tem_preferencias ? "(com preferências)" : ""}`);

if (APAGAR) {
  let sobrou = 0;
  for (const [lista, pp] of [[PORPACIENTE, true], [PORUSUARIO, false]]) {
    for (const t of lista) { try { sobrou += await conta(t, pp); } catch { /* tabela ausente */ } }
  }
  console.log(sobrou === 0 ? "  ✅ conferido: zero linhas restantes" : `  ⚠️  SOBRARAM ${sobrou} linhas`);
}
