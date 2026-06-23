ALTER TABLE "events" ADD COLUMN "is_virtual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "meeting_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;