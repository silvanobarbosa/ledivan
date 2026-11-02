-- Doc 75 item 7: "pagou a mais" passa a ser um FATO MARCADO, nao uma subtracao.
--
-- A sobra que a terapeuta respondeu NAO entrar como credito no saldo ganha coluna propria. Antes
-- so existia o texto opcional `motivo_sem_credito` (doc 72), e quem respondia "Nao" sem escrever
-- nada nao deixava rastro. Sem o fato gravado, o fechamento deduzia "pagou a mais" de pago >
-- cobrado — e acusava quem pagou varios pacotes no mes, ou um pacote adiantado ainda em aberto.
--
-- NULO = nao houve sobra, ou a sobra virou credito (que vive em patient_credits).
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "excedente_sem_credito" numeric(10, 2);
