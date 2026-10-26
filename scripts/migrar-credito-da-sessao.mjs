/**
 * `credito_valor` na sessão (doc 57).
 *
 * Quando a sessão AVUL vira GRAT e NÃO há próxima sessão elegível para receber o pagamento, o
 * valor não se perde nem vira estorno: fica como crédito do paciente. Esta coluna guarda só o
 * valor, para a guia Geral poder dizer que há um crédito esperando — o crédito em si mora em
 * `patient_credits`, junto com o resto do app.
 *
 * Coluna nova, anulável: nenhuma sessão existente muda de comportamento.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS credito_valor numeric(10,2)`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name = 'therapy_sessions' AND column_name = 'credito_valor'`;
if (!existe) { console.error("FALHOU: a coluna não existe depois do ALTER"); process.exit(1); }

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE credito_valor IS NOT NULL`;
console.log(`coluna credito_valor no ar; ${n} sessões com crédito (esperado 0 numa base existente).`);
