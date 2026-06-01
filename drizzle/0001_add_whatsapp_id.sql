ALTER TABLE "user" ADD COLUMN "whatsapp_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_whatsapp_id_unique" UNIQUE("whatsapp_id");