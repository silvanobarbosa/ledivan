-- Doc 9: "Acrescentar um botao para anexar embaixo de cada atividade inserida."
--
-- O anexo de atividade mora na MESMA tabela dos demais anexos do prontuario, do mesmo jeito que o
-- anexo preso a um registro do historico (`record_id`, doc 33). Tabela nova so repetiria regra de
-- acesso, rota de download e limpeza — tres lugares para a mesma coisa divergir.
--
-- NULO = o anexo nao pertence a nenhuma atividade. Cai junto quando a atividade e apagada.
ALTER TABLE "patient_document" ADD COLUMN IF NOT EXISTS "activity_id" uuid;

DO $$ BEGIN
  ALTER TABLE "patient_document"
    ADD CONSTRAINT "patient_document_activity_id_patient_activities_id_fk"
    FOREIGN KEY ("activity_id") REFERENCES "public"."patient_activities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "patient_document_activity_idx" ON "patient_document" ("activity_id");
