ALTER TYPE "public"."fundraiser_status" ADD VALUE 'archived';--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ALTER COLUMN "member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ALTER COLUMN "amount" SET DATA TYPE integer USING round("amount" * 100)::integer;--> statement-breakpoint
ALTER TABLE "fundraisers" ALTER COLUMN "goal_amount" SET DATA TYPE integer USING round("goal_amount" * 100)::integer;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ADD COLUMN "external_name" text;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ADD COLUMN "external_email" text;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ADD COLUMN "logged_by" uuid;--> statement-breakpoint
ALTER TABLE "fundraiser_pledges" ADD CONSTRAINT "fundraiser_pledges_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;