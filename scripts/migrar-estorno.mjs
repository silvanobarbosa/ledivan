/**
 * `estorno_valor` e `estorno_em` na sessão (doc 55).
 *
 * Quando a terapeuta desfaz a cobrança de uma sessão que JÁ tinha pagamento lançado e escolhe
 * ESTORNAR, o pagamento é apagado — o dinheiro sai de todas as somas sozinho. O que estas colunas
 * guardam é o REGISTRO do estorno, para a guia Geral poder dizer "Estorno realizado no valor de
 * R$ xx,xx" em vez de a linha simplesmente esvaziar, sem explicação de para onde foi o dinheiro.
 *
 * Colunas novas, anuláveis: nenhuma sessão existente muda de comportamento. Roda ANTES do deploy,
 * porque a guia Geral passa a lê-las.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS estorno_valor numeric(10,2)`;
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS estorno_em timestamp`;

const [{ faltam }] = await sql`
  SELECT 2 - COUNT(*)::int AS faltam
  FROM information_schema.columns
  WHERE table_name = 'therapy_sessions' AND column_name IN ('estorno_valor', 'estorno_em')
`;
if (faltam !== 0) {
  console.error("FALHOU: alguma coluna não existe depois do ALTER");
  process.exit(1);
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE estorno_em IS NOT NULL`;
console.log(`colunas de estorno no ar; ${n} estornos registrados (esperado 0 numa base existente).`);
