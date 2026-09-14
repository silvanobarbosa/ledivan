/**
 * O modelo da mensagem de "Lembrar agendamento", no perfil da terapeuta.
 *
 * Mesmo lugar e mesma ideia da mensagem de aniversário que já existe: o texto é dela, não do
 * paciente, e vale para todos. Coluna nova e anulável.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS agendamento_message text`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name = 'user' AND column_name = 'agendamento_message'
`;
if (!existe) { console.error("FALHOU"); process.exit(1); }
console.log("coluna agendamento_message no ar.");
