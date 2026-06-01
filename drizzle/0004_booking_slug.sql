ALTER TABLE "user" ADD COLUMN "booking_slug" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_booking_slug_unique" UNIQUE("booking_slug");