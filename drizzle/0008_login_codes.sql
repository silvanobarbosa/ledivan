-- Doc 55: acesso sem senha, por código de 6 dígitos no e-mail ou no Telegram.
--
-- ADITIVA (CREATE TABLE IF NOT EXISTS), como manda o drizzle.config.ts.
--
-- O CÓDIGO NÃO TEM COLUNA AQUI: `codigo_hash` guarda um HMAC-SHA256 dele. A tabela equivalente
-- do paciente (`patient_auth_code`) guarda o código em claro, o que faz de quem lê o banco um
-- usuário válido durante os 10 minutos de validade. Não se repete isso para o profissional, que
-- é quem tem o prontuário inteiro do outro lado.

CREATE TABLE IF NOT EXISTS "login_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "codigo_hash" text NOT NULL,
  "canal" text NOT NULL,
  "expira_em" timestamp NOT NULL,
  "tentativas" integer DEFAULT 0 NOT NULL,
  "usado_em" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "login_codes_user_idx" ON "login_codes" ("user_id");
