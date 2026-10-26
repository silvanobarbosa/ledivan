/**
 * `estornado_em` no pagamento (doc 57).
 *
 * Quando a terapeuta devolve o dinheiro de uma sessão, a linha do pagamento FICA — apagá-la fazia
 * a entrada sumir do extrato, e ninguém conseguia ver que houve pagamento e devolução. Com a
 * marca, o extrato mostra as duas pontas e o saldo fecha em zero, que é a verdade.
 *
 * Um pagamento estornado não quita nada: é ignorado ao casar pagamentos com cobranças.
 *
 * Coluna nova, anulável: nenhum pagamento existente muda de comportamento.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE session_payments ADD COLUMN IF NOT EXISTS estornado_em timestamp`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name = 'session_payments' AND column_name = 'estornado_em'`;
if (!existe) { console.error("FALHOU: a coluna não existe depois do ALTER"); process.exit(1); }

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM session_payments WHERE estornado_em IS NOT NULL`;
console.log(`coluna estornado_em no ar; ${n} pagamentos estornados (esperado 0 numa base existente).`);
