/**
 * A tabela dos horários bloqueados.
 *
 * Tabela nova e vazia: nada existente é tocado. Precisa rodar antes do deploy, porque a agenda
 * passa a lê-la.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS blocked_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    date timestamp NOT NULL,
    duration integer NOT NULL DEFAULT 60,
    note text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS blocked_user_date_idx ON blocked_slots (user_id, date)`;

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM blocked_slots`;
console.log(`blocked_slots no ar; ${n} bloqueios.`);
