CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"response_type" text DEFAULT 'texto' NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"due_date" timestamp,
	"response_text" text,
	"response_file_url" text,
	"response_file_type" text,
	"responded_at" timestamp,
	"therapist_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;