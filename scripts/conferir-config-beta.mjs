/**
 * A CONFERÊNCIA DEPOIS DA LIMPEZA.
 *
 * Apagar paciente é fácil de verificar; não ter apagado configuração junto, não. Este script
 * imprime, para as duas contas, cada ajuste que a terapeuta fez para si — o que estiver vazio aqui
 * ou nunca foi preenchido, ou foi perdido, e nos dois casos a pessoa precisa saber antes de
 * recomeçar os testes.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const emails = ["giselesantosbarbosa@gmail.com", "ana.raquel.bassi2020@gmail.com"];

for (const email of emails) {
  const [u] = await sql.query(`SELECT * FROM "user" WHERE email = $1`, [email]);
  if (!u) {
    console.log(`\n${email}: CONTA NÃO EXISTE MAIS — isto é um problema.`);
    continue;
  }

  // Só o que a pessoa configurou. Segredo (senha, SMTP, chave de IA) aparece como sim/não, nunca
  // com o valor: conferir que existe é o que interessa, imprimir é o que nunca pode acontecer.
  const tem = (v) => (v ? "sim" : "—");
  console.log(`\n── ${email} ──`);
  console.log(`  nome                  ${u.name ?? "—"}`);
  console.log(`  senha                 ${tem(u.password_hash)}`);
  console.log(`  papel                 ${u.role ?? "—"}`);
  console.log(`  locais de atendimento ${u.attendance_locations ?? "—"}`);
  console.log(`  cidades de feriado    ${u.holiday_cities ?? "—"}`);
  console.log(`  slug de agendamento   ${u.booking_slug ?? "—"}`);
  console.log(`  mensagem de aniversário ${u.birthday_message ? `"${u.birthday_message.slice(0, 60)}"` : "—"}`);
  console.log(`  e-mail configurado    ${tem(u.email_configured)} (smtp host ${tem(u.smtp_host)})`);
  console.log(`  whatsapp              instância ${tem(u.whatsapp_instance)}, conectado ${tem(u.whatsapp_connected)}`);
  console.log(`  IA                    provedor ${u.ai_provider ?? "—"}, chave ${tem(u.ai_key_enc)}`);
  console.log(`  telegram              ${tem(u.telegram_id)}`);
  console.log(`  foto 3x4              ${tem(u.photo_3x4)}`);
  console.log(`  preferências          ${u.preferences ? `${u.preferences.slice(0, 80)}…` : "—"}`);
  console.log(`  termos aceitos        ${u.accepted_terms_at ? "sim" : "—"}`);

  const conta = async (t, c) => (await sql.query(`SELECT COUNT(*)::int n FROM "${t}" WHERE "${c}" = $1`, [u.id]))[0].n;
  console.log(`  contas financeiras    ${await conta("financial_accounts", "user_id")}`);
  console.log(`  categorias            ${await conta("categories", "user_id")}`);
  console.log(`  termos modelo         ${await conta("consent_forms", "user_id")}`);
  console.log(`  pacientes             ${await conta("patients", "user_id")}  ← tem que ser 0`);
  console.log(`  sessões               ${await conta("therapy_sessions", "user_id")}  ← tem que ser 0`);
}
