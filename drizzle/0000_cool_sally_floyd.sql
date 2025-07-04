CREATE TABLE IF NOT EXISTS "casts" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"text" text,
	"parent_hash" varchar(64),
	"parent_fid" integer,
	"parent_url" text,
	"timestamp" timestamp with time zone NOT NULL,
	"embeds" jsonb,
	"mentions" jsonb,
	"mentions_positions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(100) NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"fid" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"data" jsonb,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "links" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"target_fid" integer NOT NULL,
	"type" varchar(10) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "on_chain_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"chain_id" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"block_timestamp" timestamp with time zone NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"fid" integer NOT NULL,
	"signer_event_body" jsonb,
	"id_registry_event_body" jsonb,
	"key_registry_event_body" jsonb,
	"storage_rent_event_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"type" varchar(10) NOT NULL,
	"target_hash" varchar(64),
	"target_fid" integer,
	"target_url" text,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"last_event_id" bigint,
	"last_synced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "target_clients" (
	"client_fid" integer PRIMARY KEY NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "targets" (
	"fid" integer PRIMARY KEY NOT NULL,
	"is_root" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_data" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"value" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "username_proofs" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner" varchar(42) NOT NULL,
	"signature" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"fid" integer PRIMARY KEY NOT NULL,
	"username" varchar(100),
	"display_name" text,
	"pfp_url" text,
	"bio" text,
	"custody_address" varchar(42),
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"hash" varchar(64) PRIMARY KEY NOT NULL,
	"fid" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"protocol" varchar(20) DEFAULT 'ethereum' NOT NULL,
	"block_hash" varchar(66),
	"timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "casts_fid_idx" ON "casts" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "casts_timestamp_idx" ON "casts" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "casts_parent_hash_idx" ON "casts" ("parent_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "casts_parent_fid_idx" ON "casts" ("parent_fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "casts_fid_timestamp_idx" ON "casts" ("fid","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_job_id_idx" ON "job_status" ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_status_idx" ON "job_status" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_job_type_idx" ON "job_status" ("job_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_fid_idx" ON "job_status" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_created_at_idx" ON "job_status" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_status_status_created_idx" ON "job_status" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_fid_idx" ON "links" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_target_fid_idx" ON "links" ("target_fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_type_idx" ON "links" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_fid_target_idx" ON "links" ("fid","target_fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "links_timestamp_idx" ON "links" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_type_idx" ON "on_chain_events" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_fid_idx" ON "on_chain_events" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_block_number_idx" ON "on_chain_events" ("block_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_block_timestamp_idx" ON "on_chain_events" ("block_timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_transaction_hash_idx" ON "on_chain_events" ("transaction_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "on_chain_events_chain_id_block_idx" ON "on_chain_events" ("chain_id","block_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_fid_idx" ON "reactions" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_type_idx" ON "reactions" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_target_hash_idx" ON "reactions" ("target_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_target_fid_idx" ON "reactions" ("target_fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_fid_type_idx" ON "reactions" ("fid","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reactions_timestamp_idx" ON "reactions" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_is_root_idx" ON "targets" ("is_root");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_last_synced_idx" ON "targets" ("last_synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_data_fid_idx" ON "user_data" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_data_type_idx" ON "user_data" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_data_fid_type_idx" ON "user_data" ("fid","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_data_timestamp_idx" ON "user_data" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_proofs_fid_idx" ON "username_proofs" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_proofs_name_idx" ON "username_proofs" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_proofs_owner_idx" ON "username_proofs" ("owner");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "username_proofs_timestamp_idx" ON "username_proofs" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_synced_at_idx" ON "users" ("synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_fid_idx" ON "verifications" ("fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_address_idx" ON "verifications" ("address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_protocol_idx" ON "verifications" ("protocol");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_timestamp_idx" ON "verifications" ("timestamp");