/**
 * `origem_sessao_id` em `session_payments` (doc 59).
 *
 * Ao TRANSFERIR, o pagamento muda de cobrança e de sessão: passa a apontar para o destino. A
 * sessão de origem guarda a data para onde o dinheiro foi — mas o caminho de volta não existia.
 *
 * Isso quebrava o "se o pagamento for excluído, ele deve sair de qualquer área do sistema, como se
 * nunca tivesse existido": removido o pagamento, a origem continuaria anunciando uma transferência
 * de um dinheiro que já não está em parte nenhuma, e não haveria como descobrir qual sessão limpar.
 *
 * Coluna nova, anulável: só a transferência a preenche.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE session_payments ADD COLUMN IF NOT EXISTS origem_sessao_id uuid`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name = 'session_payments' AND column_name = 'origem_sessao_id'`;
if (!existe) { console.error("FALHOU: a coluna não existe depois do ALTER"); process.exit(1); }

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM session_payments WHERE origem_sessao_id IS NOT NULL`;
console.log(`coluna origem_sessao_id no ar; ${n} pagamentos transferidos (esperado 0 numa base existente).`);
