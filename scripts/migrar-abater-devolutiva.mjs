/**
 * `abater_do_pacote` na sessão.
 *
 * Nasce da regra da devolutiva no lote das beta testers: marcada para abater, ela **não cobra** mas
 * **ocupa** uma posição na sequência do pacote. Sem a marca, a devolutiva acontece fora do pacote —
 * e contá-la ali roubaria uma consulta do paciente.
 *
 * Coluna nova, anulável, com padrão falso: nenhuma sessão existente muda de comportamento. Roda
 * antes do deploy porque a agenda passa a lê-la.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS abater_do_pacote boolean NOT NULL DEFAULT false`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe
  FROM information_schema.columns
  WHERE table_name = 'therapy_sessions' AND column_name = 'abater_do_pacote'
`;

if (!existe) {
  console.error("FALHOU: a coluna não existe depois do ALTER");
  process.exit(1);
}

const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM therapy_sessions WHERE abater_do_pacote`;
console.log(`coluna abater_do_pacote no ar; ${n} sessões marcadas (esperado 0 numa base existente).`);
