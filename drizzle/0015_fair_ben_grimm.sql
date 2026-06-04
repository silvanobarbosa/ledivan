ALTER TABLE "patients" ADD COLUMN "photo_3x4" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "photo_extra1" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "photo_extra2" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "photo_extra3" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "package_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "reminder_lead_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "meeting_happened" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "meeting_opened_at" timestamp;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "guest_joined_at" timestamp;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "meeting_ended_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "photo_3x4" text;