CREATE INDEX "mood_patient_idx" ON "mood_logs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "pr_patient_idx" ON "patient_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "pat_user_idx" ON "patients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sp_patient_idx" ON "session_payments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "sp_user_idx" ON "session_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ts_user_idx" ON "therapy_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ts_patient_idx" ON "therapy_sessions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ts_date_idx" ON "therapy_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tx_user_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tx_date_idx" ON "transactions" USING btree ("date");