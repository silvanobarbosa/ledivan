CREATE INDEX "pkg_user_idx" ON "patient_packages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pat_user_status_idx" ON "patients" USING btree ("user_id","patient_status");--> statement-breakpoint
CREATE INDEX "sp_user_status_idx" ON "session_payments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ts_user_status_idx" ON "therapy_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ts_user_date_idx" ON "therapy_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "ts_pending_date_idx" ON "therapy_sessions" USING btree ("pending_confirmation","date");--> statement-breakpoint
CREATE INDEX "tx_user_date_idx" ON "transactions" USING btree ("user_id","date");