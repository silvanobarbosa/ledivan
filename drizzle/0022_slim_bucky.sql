ALTER TABLE "patients" ADD COLUMN "times_per_period" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "payment_format" text DEFAULT 'avulso' NOT NULL;