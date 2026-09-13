/**
 * Os dois status novos: `prof_desmarcou` e `atestado`.
 *
 * É acréscimo puro ao enum `session_status`. Nenhuma linha muda, nenhuma coluna muda, e nenhum
 * valor existente é tocado — quem já lê os cinco antigos continua lendo. Mas precisa rodar ANTES
 * do deploy: o código passa a escrever esses valores, e escrever valor que o enum não conhece é
 * erro na hora, não aviso.
 *
 * Idempotente por `IF NOT EXISTS`: rodar de novo não faz nada.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const antes = await sql`
  SELECT e.enumlabel AS valor
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'session_status'
  ORDER BY e.enumsortorder
`;
console.log("antes: ", antes.map((r) => r.valor).join(", "));

// ALTER TYPE ... ADD VALUE não aceita parâmetro nem roda dentro de transação implícita com outros
// comandos; por isso cada um vai sozinho.
await sql`ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'prof_desmarcou'`;
await sql`ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'atestado'`;

const depois = await sql`
  SELECT e.enumlabel AS valor
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'session_status'
  ORDER BY e.enumsortorder
`;
console.log("depois:", depois.map((r) => r.valor).join(", "));

const faltando = ["prof_desmarcou", "atestado"].filter((v) => !depois.some((r) => r.valor === v));
if (faltando.length > 0) {
  console.error("FALHOU — ainda faltam:", faltando.join(", "));
  process.exit(1);
}
console.log("\nOs dois status existem no banco. Nenhuma linha foi tocada.");
