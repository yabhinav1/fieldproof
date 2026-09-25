import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1024;

export const phaseEnum = pgEnum("phase", ["before", "during", "after", "unknown"]);
export const provenancePurposeEnum = pgEnum("provenance_purpose", [
  "thumbnail",
  "comparison",
  "report",
  "campaign",
  "analysis",
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  orgName: text("org_name"),
  /** Assets captured before this date are "before"; between duringStart and afterStart are "during". */
  duringStart: timestamp("during_start", { withTimezone: true }),
  afterStart: timestamp("after_start", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** Photos further than this from the site centre are flagged. */
    radiusM: integer("radius_m").notNull().default(2000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sites_project_idx").on(t.projectId)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),

    // Cloudinary identity: the traceability anchor for everything derived later.
    cloudinaryPublicId: text("cloudinary_public_id").notNull().unique(),
    cloudinaryVersion: integer("cloudinary_version"),
    resourceType: text("resource_type").notNull().default("image"),
    secureUrl: text("secure_url").notNull(),
    format: text("format"),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),

    phase: phaseEnum("phase").notNull().default("unknown"),
    phaseOverridden: boolean("phase_overridden").notNull().default(false),
    siteOverridden: boolean("site_overridden").notNull().default(false),

    capturedAt: timestamp("captured_at", { withTimezone: true }),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    distanceToSiteM: doublePrecision("distance_to_site_m"),

    aiTags: jsonb("ai_tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    aiCaption: text("ai_caption"),
    exif: jsonb("exif").$type<Record<string, unknown>>(),
    colors: jsonb("colors").$type<Array<[string, number]>>(),
    phash: text("phash"),

    /** Text that was embedded and that keyword search runs over. */
    searchText: text("search_text"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingModel: text("embedding_model"),

    verified: boolean("verified").notNull().default(true),
    flags: jsonb("flags").$type<AssetFlag[]>().notNull().default(sql`'[]'::jsonb`),

    /** Full Cloudinary resource payload at ingest time, kept for auditability. */
    cloudinaryRaw: jsonb("cloudinary_raw").$type<Record<string, unknown>>(),

    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assets_project_idx").on(t.projectId),
    index("assets_site_idx").on(t.siteId),
    index("assets_captured_idx").on(t.capturedAt),
    index("assets_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const comparisons = pgTable(
  "comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    beforeAssetId: uuid("before_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    afterAssetId: uuid("after_asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    beforeUrl: text("before_url").notNull(),
    afterUrl: text("after_url").notNull(),
    headline: text("headline"),
    summary: text("summary"),
    sameLocation: boolean("same_location"),
    locationConfidence: doublePrecision("location_confidence"),
    metrics: jsonb("metrics").$type<ComparisonMetric[]>().notNull().default(sql`'[]'::jsonb`),
    model: text("model"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comparisons_site_idx").on(t.siteId)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Structured content the frontend renders; also used to produce the HTML. */
    content: jsonb("content").$type<ReportContent>().notNull(),
    html: text("html").notNull(),
    campaignImageUrl: text("campaign_image_url"),
    assetIds: jsonb("asset_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    comparisonIds: jsonb("comparison_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_project_idx").on(t.projectId)],
);

export const provenance = pgTable(
  "provenance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    purpose: provenancePurposeEnum("purpose").notNull(),
    derivedUrl: text("derived_url").notNull(),
    /** Cloudinary transformation string, e.g. "c_fill,w_1024,h_768/f_auto,q_auto". */
    transformation: text("transformation").notNull(),
    /** Which comparison / report this derivation was made for, if any. */
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("provenance_asset_idx").on(t.assetId)],
);

// ---------- relations ----------

export const projectsRelations = relations(projects, ({ many }) => ({
  sites: many(sites),
  assets: many(assets),
  reports: many(reports),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  project: one(projects, { fields: [sites.projectId], references: [projects.id] }),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  project: one(projects, { fields: [assets.projectId], references: [projects.id] }),
  site: one(sites, { fields: [assets.siteId], references: [sites.id] }),
  provenance: many(provenance),
}));

export const provenanceRelations = relations(provenance, ({ one }) => ({
  asset: one(assets, { fields: [provenance.assetId], references: [assets.id] }),
}));

// ---------- JSON shapes ----------

export type Phase = (typeof phaseEnum.enumValues)[number];
export type ProvenancePurpose = (typeof provenancePurposeEnum.enumValues)[number];

export type AssetFlagCode =
  | "no_gps"
  | "no_capture_date"
  | "far_from_site"
  | "no_site_match"
  | "future_date"
  | "duplicate"
  | "phase_order";

export interface AssetFlag {
  code: AssetFlagCode;
  message: string;
  /** Related asset for duplicate flags. */
  relatedAssetId?: string;
  value?: number;
}

export type MetricDirection = "decreased" | "unchanged" | "increased" | "not_visible";

export interface ComparisonMetric {
  name: string;
  direction: MetricDirection;
  reason: string;
}

export interface ReportContent {
  title: string;
  executiveSummary: string;
  keyNumbers: Array<{ label: string; value: string }>;
  sites: Array<{
    siteId: string;
    siteName: string;
    narrative: string;
    assetCount: number;
    heroComparisonId?: string;
  }>;
  callToAction: string;
  generatedAt: string;
}

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Comparison = typeof comparisons.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Provenance = typeof provenance.$inferSelect;
