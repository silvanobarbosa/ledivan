-- Doc 63: as Observações do Financeiro (assunto + texto, por paciente) e a data a partir da qual o
-- prazo do próximo reajuste conta. Nada retroativo: a coluna nasce nula e o lembrete de quem nunca
-- usar o campo continua saindo das referências antigas (início, retorno, último reajuste).
CREATE TABLE IF NOT EXISTS "patient_observacoes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "patient_id" uuid NOT NULL,
  "assunto" text NOT NULL,
  "observacao" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "patient_observacoes" ADD CONSTRAINT "patient_observacoes_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "patient_observacoes" ADD CONSTRAINT "patient_observacoes_patient_id_patients_id_fk"
    FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "patient_observacoes_patient_idx" ON "patient_observacoes" ("patient_id");

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "reajuste_a_partir_de" timestamp;
