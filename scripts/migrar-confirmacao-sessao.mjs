/**
 * Modalidade e confirmação por sessão.
 *
 * - `modality`: presencial | online | misto. O `is_online` continua existindo e é lido por meia
 *   dúzia de telas; a modalidade é mais rica e o booleano passa a sair dela. Nas sessões antigas
 *   a modalidade nasce coerente com o que já estava lá.
 * - `confirm_channel` e `confirm_lead_hours`: o "Confirmar sessão" do lote — por WhatsApp ou
 *   e-mail, tantas horas antes. É diferente de `pending_confirmation`, que marca reserva pedida
 *   pelo link público.
 *
 * Tudo aditivo e anulável: nenhuma sessão muda de comportamento.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS modality text`;
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS confirm_channel text`;
await sql`ALTER TABLE therapy_sessions ADD COLUMN IF NOT EXISTS confirm_lead_hours integer`;

// As sessões que já existiam ganham a modalidade que o booleano já dizia — deixá-las nulas faria a
// janela de edição abrir sem modalidade escolhida, e a pessoa teria que reescolher a cada edição.
const r = await sql`
  UPDATE therapy_sessions
  SET modality = CASE WHEN is_online THEN 'online' ELSE 'presencial' END
  WHERE modality IS NULL
  RETURNING id
`;
console.log(`${r.length} sessões receberam a modalidade a partir do is_online.`);

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'therapy_sessions' AND column_name IN ('modality','confirm_channel','confirm_lead_hours')
  ORDER BY column_name
`;
console.log("colunas:", cols.map((c) => c.column_name).join(", "));
if (cols.length !== 3) { console.error("FALHOU: faltou coluna"); process.exit(1); }
