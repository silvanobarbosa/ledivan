-- Doc 69: "Aplicar sobre o pacote vigente ou o proximo a iniciar?"
-- SEM default: linha antiga fica NULA de proposito. Nulo = "ninguem respondeu", e e o que mantem
-- as cobrancas ja existentes exatamente como estao. A resposta so passa a existir de agora em diante.
ALTER TABLE "patient_price_history" ADD COLUMN IF NOT EXISTS "aplica_em" text;
