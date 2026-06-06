ALTER TABLE "patients" ADD COLUMN "attendance_mode" text DEFAULT 'presencial' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "attendance_location" text;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN "pending_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "attendance_locations" text;