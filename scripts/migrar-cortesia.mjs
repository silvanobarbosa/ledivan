/**
 * `cortesia` na sessão (doc 54, item 03).
 *
 * Um atendimento do pacote que a terapeuta decide não cobrar. Ele deixa de ocupar posição na
 * sequência — a sessão seguinte assume o número que ele teria — mas continua pertencendo ao pacote
 * e ao grupo de pagamento dele. É o que o separa de `extra = 'grat'`, que acontece FORA do pacote e
 * seria o lançamento isolado que o documento proíbe.
 *
 * Coluna nova, NOT NULL com padrão falso: nenhuma sessão existente muda de comportamento. Roda
 * ANTES do deploy, porque a agenda e a guia Geral passam a lê-la.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS cortesia boolean NOT NULL DEFAULT false`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe
  FROM information_schema.columns
  WHERE table_name = 'therapy_sessions' AND column_name = 'cortesia'
`;

if (!existe) {
  console.error("FALHOU: a coluna não existe depois do ALTER");
  process.exit(1);
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE cortesia`;
console.log(`coluna cortesia no ar; ${n} sessões marcadas (esperado 0 numa base existente).`);
