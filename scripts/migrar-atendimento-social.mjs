/**
 * `atendimento_social` no paciente.
 *
 * Social e gratuito eram a mesma coisa no código — "social" era só a palavra que a tela usava para
 * quem tinha formato de pagamento gratuito. São critérios DIFERENTES: social é o tipo de vínculo
 * (projeto, convênio, indicação institucional) e existe junto com QUALQUER formato de pagamento.
 * Um paciente pode ser social e pagar mensal, ou social e ser gratuito.
 *
 * Coluna nova, com padrão falso. Ninguém nasce social sem alguém marcar: converter os gratuitos
 * atuais em sociais seria justamente repetir a confusão que esta coluna existe para desfazer.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS atendimento_social boolean NOT NULL DEFAULT false`;

const [{ existe }] = await sql`
  SELECT COUNT(*)::int > 0 AS existe FROM information_schema.columns
  WHERE table_name='patients' AND column_name='atendimento_social'`;
if (!existe) { console.error("FALHOU"); process.exit(1); }

const [{ n }] = await sql`SELECT COUNT(*)::int n FROM patients WHERE atendimento_social`;
const [{ g }] = await sql`SELECT COUNT(*)::int g FROM patients WHERE payment_format = 'gratuito'`;
console.log(`coluna no ar. ${n} marcados como social (esperado 0), ${g} gratuitos — e os dois grupos agora são independentes.`);
