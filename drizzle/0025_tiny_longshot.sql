ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "demo_expires" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "accepted_terms_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "accepted_privacy_at" timestamp;