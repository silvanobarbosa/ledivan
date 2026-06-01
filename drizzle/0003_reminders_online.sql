ALTER TABLE "patients" ADD COLUMN "reminder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "reminder_channel" text DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "is_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "reminder_sent_at" timestamp;