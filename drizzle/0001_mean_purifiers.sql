CREATE TABLE "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_urls" integer DEFAULT 0 NOT NULL,
	"processed_urls" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "enrichment_source" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "enrichment_error" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "uptime_status" text DEFAULT 'unchecked' NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "last_status_code" integer;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "last_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "stash_state" text;--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "stashed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "encrypted_api_key" text;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "links_user_stash_state_idx" ON "links" USING btree ("user_id","stash_state");