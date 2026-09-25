CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."phase" AS ENUM('before', 'during', 'after', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."provenance_purpose" AS ENUM('thumbnail', 'comparison', 'report', 'campaign', 'analysis');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_version" integer,
	"resource_type" text DEFAULT 'image' NOT NULL,
	"secure_url" text NOT NULL,
	"format" text,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"phase" "phase" DEFAULT 'unknown' NOT NULL,
	"phase_overridden" boolean DEFAULT false NOT NULL,
	"site_overridden" boolean DEFAULT false NOT NULL,
	"captured_at" timestamp with time zone,
	"lat" double precision,
	"lng" double precision,
	"distance_to_site_m" double precision,
	"ai_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_caption" text,
	"exif" jsonb,
	"colors" jsonb,
	"phash" text,
	"search_text" text,
	"embedding" vector(1024),
	"embedding_model" text,
	"verified" boolean DEFAULT true NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cloudinary_raw" jsonb,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_cloudinary_public_id_unique" UNIQUE("cloudinary_public_id")
);
--> statement-breakpoint
CREATE TABLE "comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"before_asset_id" uuid NOT NULL,
	"after_asset_id" uuid NOT NULL,
	"before_url" text NOT NULL,
	"after_url" text NOT NULL,
	"headline" text,
	"summary" text,
	"same_location" boolean,
	"location_confidence" double precision,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"org_name" text,
	"during_start" timestamp with time zone,
	"after_start" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"purpose" "provenance_purpose" NOT NULL,
	"derived_url" text NOT NULL,
	"transformation" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"html" text NOT NULL,
	"campaign_image_url" text,
	"asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_m" integer DEFAULT 2000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_before_asset_id_assets_id_fk" FOREIGN KEY ("before_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_after_asset_id_assets_id_fk" FOREIGN KEY ("after_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance" ADD CONSTRAINT "provenance_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "assets_site_idx" ON "assets" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "assets_captured_idx" ON "assets" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX "assets_embedding_idx" ON "assets" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "comparisons_site_idx" ON "comparisons" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "provenance_asset_idx" ON "provenance" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "reports_project_idx" ON "reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sites_project_idx" ON "sites" USING btree ("project_id");