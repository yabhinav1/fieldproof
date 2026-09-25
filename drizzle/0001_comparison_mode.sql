CREATE TYPE "public"."comparison_mode" AS ENUM('same_spot', 'representative');--> statement-breakpoint
ALTER TABLE "comparisons" ADD COLUMN "mode" "comparison_mode" DEFAULT 'same_spot' NOT NULL;