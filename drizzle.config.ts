import { config } from 'dotenv';
config({ path: '.env.local' });
import { defineConfig } from 'drizzle-kit';

// FONTE DA VERDADE DO SCHEMA = src/db/schema.ts, aplicado por `npm run db:push` (drizzle-kit push).
// Este projeto NÃO usa o fluxo de migrações versionadas (`db:migrate`): o banco de produção foi
// construído/mantido por push + ALTER/CREATE aditivos, então os arquivos em ./drizzle estão
// desatualizados e `db:migrate` num ambiente novo nasceria quebrado. Para provisionar/sincronizar
// um ambiente, use `db:push` (que lê o schema.ts direto). Mudanças de schema em prod: sempre
// ADITIVAS (ADD COLUMN/CREATE TABLE IF NOT EXISTS) para não arriscar drift destrutivo.
export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
