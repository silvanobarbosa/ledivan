/**
 * `transferido_para` e `credito_usado_em` na sessão (doc 58).
 *
 * As duas mensagens que o documento pede na coluna Pagamento já estavam escritas em `guiaGeral`,
 * mas nenhuma das duas podia aparecer: não havia onde guardar o fato.
 *
 * - `transferido_para` — a DATA da sessão que recebeu o pagamento. Sem ela, "este pagamento foi
 *   transferido para a data xx/xx/xx" nunca tinha data para dizer, e a transferência ficava
 *   invisível: a linha esvaziava e o dinheiro aparecia noutro lugar, sem ligação entre as duas.
 * - `credito_usado_em` — a data da sessão em que o crédito foi finalmente abatido. É ela que troca
 *   "possui um crédito que será abatido" por "crédito utilizado na sessão do dia xx/xx/xx".
 *
 * Colunas novas, anuláveis: nenhuma sessão existente muda de comportamento.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS transferido_para timestamp`;
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS credito_usado_em timestamp`;

const faltando = [];
for (const coluna of ["transferido_para", "credito_usado_em"]) {
  const [{ existe }] = await sql`
    SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
    WHERE table_name = 'therapy_sessions' AND column_name = ${coluna}`;
  if (!existe) faltando.push(coluna);
}
if (faltando.length) { console.error(`FALHOU: ${faltando.join(", ")} não existe(m) depois do ALTER`); process.exit(1); }

const [{ t, c }] = await sql`
  SELECT COUNT(*) FILTER (WHERE transferido_para IS NOT NULL)::int AS t,
         COUNT(*) FILTER (WHERE credito_usado_em IS NOT NULL)::int AS c
  FROM therapy_sessions`;
console.log(`colunas no ar; ${t} transferências e ${c} créditos usados (esperado 0 numa base existente).`);
