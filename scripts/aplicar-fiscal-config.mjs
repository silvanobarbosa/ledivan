/**
 * APLICA A TABELA `fiscal_config` — só ela, e só se não existir.
 *
 * Não uso `drizzle-kit push` aqui de propósito. O push compara o schema INTEIRO com o banco e,
 * num repo onde os arquivos de migração estão reconhecidamente desatualizados
 * (ver `drizzle.config.ts`), qualquer divergência vira ALTER ou DROP que ninguém pediu — e já
 * houve caso na frota de um push com schema parcial apagar as tabelas de autenticação.
 *
 * Aqui roda um `CREATE TABLE IF NOT EXISTS` e nada mais. Conferir antes e depois faz parte.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const sql = neon(process.env.DATABASE_URL);
const existe = async () => {
  const [r] = await sql`select to_regclass('public.fiscal_config') is not null as tem`;
  return r.tem;
};

console.log("antes:", (await existe()) ? "a tabela JÁ existe" : "não existe");

const ddl = readFileSync("drizzle/0007_fiscal_config.sql", "utf8");
// O driver HTTP do Neon não aceita múltiplas statements; este arquivo tem uma só.
await sql.query(ddl.replace(/^--.*$/gm, "").trim());

console.log("depois:", (await existe()) ? "existe" : "FALHOU");

const colunas = await sql`
  select column_name, data_type from information_schema.columns
  where table_name = 'fiscal_config' order by ordinal_position`;
console.log(`colunas (${colunas.length}):`, colunas.map((c) => c.column_name).join(", "));
