/**
 * `processo_encerramento` no paciente (doc 63).
 *
 * O mínimo de sessões de desligamento combinado com aquele paciente. Texto, e não número, porque o
 * combinado é uma faixa ("2 a 4"). Preenchido, entra na cláusula 8.1 do contrato; vazio, a seção do
 * encerramento não sai — e a do foro assume o número 8.
 *
 * Coluna nova e opcional: nenhum cadastro existente muda. Roda ANTES do deploy, porque o cadastro e
 * o contrato passam a lê-la.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS processo_encerramento text`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe
  FROM information_schema.columns
  WHERE table_name = 'patients' AND column_name = 'processo_encerramento'
`;

if (!existe) {
  console.error("FALHOU: a coluna não existe depois do ALTER");
  process.exit(1);
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM patients WHERE processo_encerramento IS NOT NULL`;
console.log(`coluna processo_encerramento no ar; ${n} cadastros preenchidos (esperado 0 numa base existente).`);
