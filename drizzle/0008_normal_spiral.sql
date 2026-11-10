CREATE TYPE "public"."expense_audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE');--> statement-breakpoint
CREATE TABLE "expense_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "expense_audit_action" NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_audit_logs_expense_id_idx" ON "expense_audit_logs" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_audit_logs_actor_id_idx" ON "expense_audit_logs" USING btree ("actor_id");