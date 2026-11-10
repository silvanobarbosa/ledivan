/**
 * Doc 63: as Observações do Financeiro e a data base do próximo reajuste.
 *
 * `patient_observacoes` guarda assunto + texto por paciente — anotação livre da terapeuta, que não
 * entra em conta nenhuma. `patients.reajuste_a_partir_de` é a data escolhida no calendário a partir
 * da qual o prazo do lembrete conta; nula, o lembrete segue saindo das referências antigas.
 *
 * Nada é retroativo: tabela nova e coluna nova e opcional. Roda ANTES do deploy.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS patient_observacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assunto text NOT NULL,
    observacao text NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL
  )
`;
await sql`CREATE INDEX IF NOT EXISTS patient_observacoes_patient_idx ON patient_observacoes (patient_id)`;
await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS reajuste_a_partir_de timestamp`;

const [{ tabela }] = await sql`SELECT to_regclass('public.patient_observacoes') IS NOT NULL AS tabela`;
const [{ coluna }] = await sql`
  SELECT COUNT(*)::int > 0 AS coluna FROM information_schema.columns
  WHERE table_name = 'patients' AND column_name = 'reajuste_a_partir_de'
`;
if (!tabela || !coluna) {
  console.error("FALHOU: tabela ou coluna não existe depois da migração");
  process.exit(1);
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM patient_observacoes`;
const [{ m }] = await sql`SELECT COUNT(*)::int AS m FROM patients WHERE reajuste_a_partir_de IS NOT NULL`;
console.log(`patient_observacoes no ar com ${n} linhas; ${m} cadastros com data de reajuste (esperado 0 e 0).`);
