CREATE TABLE "space_members" (
	"user_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "space_members_user_id_space_id_unique" UNIQUE("user_id","space_id")
);
--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;