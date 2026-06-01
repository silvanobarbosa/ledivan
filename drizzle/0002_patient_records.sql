CREATE TABLE "patient_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"session_id" uuid,
	"type" text DEFAULT 'evolucao' NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_records" ADD CONSTRAINT "patient_records_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE set null ON UPDATE no action;