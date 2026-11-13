/**
 * A tabela `app_falhas`: onde o motivo de uma tela quebrada passa a ficar.
 *
 * Roda ANTES do deploy. Tabela nova e isolada — nada existente é tocado, nada é retroativo. Se o
 * deploy subir antes desta migração, a única consequência é que `registrarFalha` falha calado (ele
 * é melhor-esforço de propósito) e a tela de erro mostra o hash do Next em vez do nosso código.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS app_falhas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id text,
    acao text NOT NULL,
    alvo text,
    codigo text NOT NULL,
    mensagem text NOT NULL,
    pilha text,
    created_at timestamp DEFAULT now() NOT NULL
  )
`;
await sql`CREATE INDEX IF NOT EXISTS app_falhas_created_idx ON app_falhas (created_at)`;

const [{ tabela }] = await sql`SELECT to_regclass('public.app_falhas') IS NOT NULL AS tabela`;
if (!tabela) {
  console.error("FALHOU: app_falhas não existe depois da migração");
  process.exit(1);
}
const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM app_falhas`;
console.log(`OK: app_falhas existe, ${n} falha(s) registrada(s).`);
