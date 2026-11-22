ALTER TYPE "public"."invitation_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "expense_audit_logs" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."expense_audit_action";--> statement-breakpoint
CREATE TYPE "public"."expense_audit_action" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE');--> statement-breakpoint
ALTER TABLE "expense_audit_logs" ALTER COLUMN "action" SET DATA TYPE "public"."expense_audit_action" USING "action"::"public"."expense_audit_action";