/**
 * `nao_auto` em `patient_credits` (doc 59).
 *
 * O crédito passa a ir SOZINHO para a próxima sessão que tem o que pagar. Isso cria um conflito com
 * a terapeuta: se ela remover o crédito de uma sessão para pôr em outra — que o documento permite
 * em letra ("a não ser que seja retirado de um lugar para colocar em outro") —, a aplicação
 * automática o devolveria na mesma hora, e ela não conseguiria movê-lo nunca.
 *
 * Esta marca diz "este crédito não vai mais sozinho". Ela só é posta quando a pessoa REMOVE uma
 * aplicação automática; a partir daí o crédito continua disponível, mas só entra onde ela mandar.
 *
 * Coluna nova com padrão `false`: nenhum crédito existente muda de comportamento.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE patient_credits ADD COLUMN IF NOT EXISTS nao_auto boolean NOT NULL DEFAULT false`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name = 'patient_credits' AND column_name = 'nao_auto'`;
if (!existe) { console.error("FALHOU: a coluna não existe depois do ALTER"); process.exit(1); }

const [{ n, bloqueados }] = await sql`
  SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE nao_auto)::int AS bloqueados FROM patient_credits`;
console.log(`coluna nao_auto no ar; ${n} créditos, ${bloqueados} marcados (esperado 0).`);
