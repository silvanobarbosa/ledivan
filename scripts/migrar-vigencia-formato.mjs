/**
 * Vigência do formato de pagamento + sessão extra + quem pagou. Tudo ADITIVO.
 *
 * 1. `patient_payment_format_history` — uma linha por troca de formato. Regra do dono (15/09/2026):
 *    a troca vale a partir da data definida, sem mexer no passado.
 *
 *    BACKFILL: cada paciente ganha UMA linha com o formato de hoje, desde o início dele. Isso não é
 *    reconstrução de história — é congelar o que existe, para que nenhuma tela mude no dia do
 *    deploy. O primeiro período vale para trás, então a data exata não altera conta nenhuma.
 *    Não reconstruo a partir de `patient_contract_history`: lá há 16 linhas, guardam rótulo e não
 *    chave, e a única com alternância é o paciente de teste — quem trocou achando que a troca era
 *    global. Replicar isso como vigência inventaria cobrança.
 *
 * 2. `therapy_sessions.extra` / `valor_extra` — sessão fora da sequência (AVUL/GRAT).
 * 3. `session_payments.pago_por` / `cobranca_chave` — o responsável e a cobrança paga.
 *
 * Idempotente: pode rodar de novo, não duplica linha nem quebra coluna existente.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS patient_payment_format_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  formato text NOT NULL,
  pacote_tipo text,
  data_efetiva timestamp NOT NULL,
  data_criacao timestamp NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS ppfh_patient_idx ON patient_payment_format_history(patient_id)`;

await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS extra text`;
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS valor_extra numeric(10,2)`;
await sql`ALTER TABLE session_payments ADD COLUMN IF NOT EXISTS pago_por text`;
await sql`ALTER TABLE session_payments ADD COLUMN IF NOT EXISTS cobranca_chave text`;

const [{ antes }] = await sql`SELECT COUNT(*)::int antes FROM patient_payment_format_history`;
await sql`
  INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
  SELECT p.id, p.payment_format, p.pacote_tipo, date_trunc('day', COALESCE(p.started_at, p.created_at))
  FROM patients p
  WHERE NOT EXISTS (SELECT 1 FROM patient_payment_format_history h WHERE h.patient_id = p.id)`;
const [{ depois }] = await sql`SELECT COUNT(*)::int depois FROM patient_payment_format_history`;
const [{ pacientes }] = await sql`SELECT COUNT(*)::int pacientes FROM patients`;
const [{ sem }] = await sql`
  SELECT COUNT(*)::int sem FROM patients p
  WHERE NOT EXISTS (SELECT 1 FROM patient_payment_format_history h WHERE h.patient_id = p.id)`;
const [{ divergem }] = await sql`
  SELECT COUNT(*)::int divergem FROM patients p
  JOIN LATERAL (SELECT formato FROM patient_payment_format_history h WHERE h.patient_id = p.id
                ORDER BY data_efetiva DESC, data_criacao DESC LIMIT 1) u ON true
  WHERE u.formato <> p.payment_format`;

const cols = await sql`
  SELECT table_name || '.' || column_name AS c FROM information_schema.columns
  WHERE (table_name = 'therapy_sessions' AND column_name IN ('extra', 'valor_extra'))
     OR (table_name = 'session_payments' AND column_name IN ('pago_por', 'cobranca_chave'))`;

console.log(`vigência: ${antes} → ${depois} linhas; ${pacientes} pacientes, ${sem} sem vigência (esperado 0)`);
console.log(`última vigência ≠ formato do cadastro: ${divergem} (esperado 0 — senão alguma tela mudaria no deploy)`);
console.log(`colunas novas: ${cols.map((r) => r.c).sort().join(", ")}`);
if (sem > 0 || divergem > 0 || cols.length !== 4) {
  console.error("FALHOU");
  process.exit(1);
}
