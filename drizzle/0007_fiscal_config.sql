-- Doc 76: configuração fiscal da nota de serviço, uma por terapeuta.
--
-- ADITIVA de propósito (CREATE TABLE IF NOT EXISTS). O projeto mantém o schema por `db:push`, e
-- `drizzle.config.ts` avisa: mudança em produção é sempre aditiva, nunca destrutiva.
--
-- A SENHA DO CERTIFICADO NÃO TEM COLUNA AQUI, e isso é desenho, não esquecimento: o `.pfx` fica
-- cifrado em `certificado_enc` (AES-256-GCM, lib/crypto) e a senha é pedida na hora de emitir e
-- descartada. Sem a senha, um vazamento do banco não entrega a assinatura de ninguém.

CREATE TABLE IF NOT EXISTS "fiscal_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,

  "municipio_uf" text,
  "municipio_nome" text,
  "inscricao_municipal" text,

  "cpf" text,
  "cnpj_tecnico" text,
  "endereco_fiscal" text,
  "codigo_servico" text,
  "regime_tributario" text,

  "certificado_enc" text,
  "certificado_nome_arquivo" text,
  "certificado_titular" text,
  "certificado_documento" text,
  "certificado_tipo" text,
  "certificado_valido_ate" timestamp,
  "certificado_enviado_em" timestamp,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
