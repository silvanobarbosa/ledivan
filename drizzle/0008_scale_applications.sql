CREATE TABLE "scale_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"token" text NOT NULL,
	"scale_type" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"answers" text,
	"score" integer,
	"severity" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scale_applications_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "scale_applications" ADD CONSTRAINT "scale_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scale_applications" ADD CONSTRAINT "scale_applications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;