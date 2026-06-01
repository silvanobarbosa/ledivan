ALTER TABLE "user" ADD COLUMN "whatsapp_instance" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "whatsapp_connected" boolean DEFAULT false NOT NULL;