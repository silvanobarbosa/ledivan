-- A falha que a pessoa viu, com um código para casar o relato com o motivo.
--
-- Até aqui uma exceção em Server Action derrubava a tela num "A server error occurred" e o motivo
-- não existia em lugar nenhum: em produção o Next REDIGE a mensagem antes de ela chegar ao
-- navegador, e a Vercel no plano gratuito não guarda log de runtime. Esta tabela é onde o motivo
-- fica. Nada de segredo entra: `registrarFalha` peneira mensagem e pilha antes de gravar.
--
-- Sem FK em user_id de propósito: falha de sessão inválida não tem dono a referenciar.
CREATE TABLE IF NOT EXISTS "app_falhas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "acao" text NOT NULL,
  "alvo" text,
  "codigo" text NOT NULL,
  "mensagem" text NOT NULL,
  "pilha" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "app_falhas_created_idx" ON "app_falhas" ("created_at");
