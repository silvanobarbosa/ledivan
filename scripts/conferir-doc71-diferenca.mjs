/**
 * Doc 71, item 3 — onde a diferença marcada "fica nesta cobrança" ainda rola.
 *
 * Monta a cena da dona num cadastro de QA, roda o MESMO motor que a guia Geral usa
 * (`geralDoPaciente`) e imprime cada cobrança com valor, falta e o que foi transferido. Apaga o
 * cadastro no fim.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const { geralDoPaciente } = await import("../src/lib/geralDoPaciente.ts");

const sql = neon(process.env.DATABASE_URL);
const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
const parede = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0));
};

const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                        payment_day, sessions_in_packet, started_at, agenda_id)
  VALUES (${qa.id}, ${"QA doc71 diferenca"}, 'mensal', 'completo', '50.00', 'ativo', 10, 4,
          ${new Date(new Date().getFullYear() - 1, 0, 5)}, 'D71QA')
  RETURNING id`;
await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
          VALUES (${p.id}, 'mensal', 'completo', ${new Date(new Date().getFullYear() - 1, 0, 5)})`;
for (let i = 0; i < 8; i++) {
  const dia = i < 4 ? -60 + i * 7 : -28 + (i - 4) * 7;
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
            VALUES (${qa.id}, ${p.id}, ${parede(dia, 14)}, 'realizada', 50, 'consulta')`;
}

const mostrar = async (titulo) => {
  const g = await geralDoPaciente(qa.id, p.id);
  console.log(`\n${titulo}`);
  for (const l of g.linhas) {
    if (l.tipo !== "pagamento") continue;
    console.log(`   ${l.chave.padEnd(22)} valor=${l.valor} falta=${l.falta} transferido=${l.transferido} arrasto=${l.arrastoRecebido} situacao=${l.situacao}`);
  }
};

await mostrar("ANTES de qualquer pagamento:");

const [primeira] = await sql`SELECT chave FROM (SELECT 'pacote:inicio:0' AS chave) t`;
await sql`INSERT INTO session_payments (user_id, patient_id, cobranca_chave, amount, date, status, method, pago_por, diferenca_outra_data)
          VALUES (${qa.id}, ${p.id}, ${primeira.chave}, '100.00', ${parede(-20, 12)}, 'paid', 'pix', 'QA', true)`;
await mostrar("DEPOIS de R$ 100,00 com a marca 'fica nesta cobrança':");

await sql`DELETE FROM session_payments WHERE patient_id = ${p.id}`;
await sql`DELETE FROM therapy_sessions WHERE patient_id = ${p.id}`;
await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
await sql`DELETE FROM patients WHERE id = ${p.id}`;
console.log("\ncadastro de QA apagado");
process.exit(0);
