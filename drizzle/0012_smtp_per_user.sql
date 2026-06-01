ALTER TABLE "user" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "smtp_secure" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "smtp_pass_enc" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "smtp_from_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_configured" boolean DEFAULT false NOT NULL;