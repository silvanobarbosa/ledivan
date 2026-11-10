-- Doc 63: o processo de encerramento combinado com o paciente (quantidade mínima de sessões de
-- desligamento). Texto, porque o combinado costuma ser uma faixa ("2 a 4"). Vazio = a cláusula 8.1
-- não sai no contrato.
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "processo_encerramento" text;
