import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, provenance, sites, type Asset, type Phase } from "../db/schema";
import {
  TRANSFORMS,
  derivedUrl,
  enrichResource,
  extractAiTags,
  extractCaption,
  fetchResource,
  type CloudinaryResource,
} from "../cloudinary";
import { extractGps, nearest } from "../lib/geo";
import { extractCapturedAt } from "../lib/exif";
import { assignPhase } from "../lib/phase";
import { isValidPhash } from "../lib/phash";
import { isVerified, verifyAsset } from "../lib/verify";
import { embedTexts, embeddingModelName } from "../ai/embeddings";
import { describeImage } from "../ai/describe";
import { getProject } from "./projects";
import { badRequest } from "../http";

export const IngestSchema = z.object({
  projectId: z.string().uuid(),
  /** Cloudinary public IDs to ingest. The server fetches metadata itself. */
  publicIds: z.array(z.string().min(1)).min(1).max(200),
  /** Optional manual overrides applied to every asset in this batch. */
  siteId: z.string().uuid().optional(),
  phase: z.enum(["before", "during", "after"]).optional(),
  /** Re-run Cloudinary analysis add-ons (tagging, captioning) rather than reading stored metadata. */
  analyze: z.boolean().default(true),
});

export type IngestInput = z.infer<typeof IngestSchema>;

export interface IngestResultItem {
  publicId: string;
  status: "created" | "updated" | "failed";
  assetId?: string;
  siteId?: string | null;
  phase?: Phase;
  flags?: Asset["flags"];
  error?: string;
}

/**
 * Turns Cloudinary uploads into organised, verified assets.
 * For each public ID: enrich → parse EXIF → assign site by GPS → assign phase by date →
 * run verification → embed → store → record the thumbnail derivation in provenance.
 */
export async function ingestAssets(db: Database, input: IngestInput): Promise<IngestResultItem[]> {
  const project = await getProject(db, input.projectId);
  const siteRows = await db.select().from(sites).where(eq(sites.projectId, project.id));
  if (input.siteId && !siteRows.some((s) => s.id === input.siteId)) {
    throw badRequest("siteId does not belong to this project.");
  }

  const results: IngestResultItem[] = [];

  for (const publicId of input.publicIds) {
    try {
      const resource = input.analyze ? await enrichResource(publicId) : await fetchResource(publicId);
      const item = await ingestResource(db, {
        resource,
        project,
        siteRows,
        siteOverride: input.siteId,
        phaseOverride: input.phase,
      });
      results.push(item);
    } catch (err) {
      results.push({ publicId, status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Embeddings in one batch for everything that made it in.
  await embedPending(db, results.filter((r) => r.assetId).map((r) => r.assetId!));

  return results;
}

interface IngestResourceArgs {
  resource: CloudinaryResource;
  project: { id: string; duringStart: Date | null; afterStart: Date | null };
  siteRows: Array<typeof sites.$inferSelect>;
  siteOverride?: string;
  phaseOverride?: Phase;
}

/** Pure-ish core used by both the API route and the bulk upload script. Exported for tests. */
export async function ingestResource(db: Database, args: IngestResourceArgs): Promise<IngestResultItem> {
  const { resource, project, siteRows } = args;
  const meta = (resource.image_metadata ?? {}) as Record<string, unknown>;

  const gps = extractGps(meta);
  const capturedAt = extractCapturedAt(meta) ?? (resource.created_at ? new Date(resource.created_at) : null);
  const exifCapturedAt = extractCapturedAt(meta);

  // Site assignment.
  let siteId: string | null = args.siteOverride ?? null;
  let distanceToSiteM: number | null = null;
  let siteMatched = Boolean(args.siteOverride);
  let siteRadiusM: number | null = null;

  if (gps && siteRows.length) {
    const best = nearest(gps, siteRows);
    if (best) {
      distanceToSiteM = best.distanceM;
      if (!args.siteOverride) {
        if (best.distanceM <= best.item.radiusM) {
          siteId = best.item.id;
          siteMatched = true;
          siteRadiusM = best.item.radiusM;
        }
      } else {
        const chosen = siteRows.find((s) => s.id === args.siteOverride)!;
        distanceToSiteM = nearest(gps, [chosen])!.distanceM;
        siteRadiusM = chosen.radiusM;
      }
    }
  } else if (args.siteOverride) {
    siteRadiusM = siteRows.find((s) => s.id === args.siteOverride)?.radiusM ?? null;
  }

  // Phase assignment (EXIF date only; upload time is not evidence of when a photo was taken).
  const phase: Phase = args.phaseOverride ?? assignPhase(exifCapturedAt, project);

  let aiTags = extractAiTags(resource);
  let aiCaption = extractCaption(resource);
  // Cloudinary add-ons are quota-limited on free plans; fill any gap with the vision model so
  // search and reports never depend on the add-on budget. Non-fatal if the model is unavailable.
  if (!aiCaption || aiTags.length === 0) {
    try {
      const described = await describeImage(derivedUrl(resource.public_id, TRANSFORMS.analysis).url);
      if (described) {
        if (!aiCaption) aiCaption = described.caption;
        if (aiTags.length === 0) aiTags = described.tags;
      }
    } catch (err) {
      console.warn(`[ingest] vision description failed for ${resource.public_id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  const phash = isValidPhash(resource.phash) ? resource.phash.toLowerCase() : null;

  const peers = await db
    .select({ id: assets.id, phash: assets.phash, phase: assets.phase, capturedAt: assets.capturedAt, siteId: assets.siteId })
    .from(assets)
    .where(and(eq(assets.projectId, project.id), ne(assets.cloudinaryPublicId, resource.public_id)));

  const flags = verifyAsset({
    capturedAt: exifCapturedAt,
    hasGps: Boolean(gps),
    siteMatched,
    distanceToSiteM,
    siteRadiusM,
    // A manual phase is an assertion by the uploader; don't second-guess it against EXIF ordering.
    phase: args.phaseOverride ? "unknown" : phase,
    phash,
    peers,
    siteId,
  });

  const siteName = siteRows.find((s) => s.id === siteId)?.name;
  const searchText = buildSearchText({ caption: aiCaption, tags: aiTags, siteName, phase, capturedAt: exifCapturedAt });

  const values = {
    projectId: project.id,
    siteId,
    cloudinaryPublicId: resource.public_id,
    cloudinaryVersion: resource.version ?? null,
    resourceType: resource.resource_type ?? "image",
    secureUrl: resource.secure_url,
    format: resource.format ?? null,
    width: resource.width ?? null,
    height: resource.height ?? null,
    bytes: resource.bytes ?? null,
    phase,
    phaseOverridden: Boolean(args.phaseOverride),
    siteOverridden: Boolean(args.siteOverride),
    capturedAt,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    distanceToSiteM,
    aiTags,
    aiCaption,
    exif: Object.keys(meta).length ? meta : null,
    colors: resource.colors ?? null,
    phash,
    searchText,
    embedding: null,
    embeddingModel: null,
    verified: isVerified(flags),
    flags,
    cloudinaryRaw: stripHeavy(resource),
    uploadedAt: resource.created_at ? new Date(resource.created_at) : null,
    updatedAt: new Date(),
  };

  const existing = await db.query.assets.findFirst({ where: eq(assets.cloudinaryPublicId, resource.public_id) });

  let row: Asset;
  if (existing) {
    // Re-analysis must not undo manual decisions: keep an overridden site/phase and a
    // human-set verification unless this call explicitly overrides them again.
    if (existing.siteOverridden && !args.siteOverride) {
      values.siteId = existing.siteId;
      values.siteOverridden = true;
      values.distanceToSiteM = existing.distanceToSiteM;
    }
    if (existing.phaseOverridden && !args.phaseOverride) {
      values.phase = existing.phase;
      values.phaseOverridden = true;
    }
    // A demo-fixture date was set on purpose; a re-analysis must not swap it for EXIF or upload time.
    if (existing.flags.some((f) => f.code === "demo_date")) {
      values.capturedAt = existing.capturedAt;
    }
    const keptFlags = existing.flags.filter((f) => f.code === "demo_date");
    values.flags = [...values.flags.filter((f) => f.code !== "no_capture_date" || !keptFlags.length), ...keptFlags];
    values.verified = isVerified(values.flags);
    [row] = await db.update(assets).set(values).where(eq(assets.id, existing.id)).returning();
  } else {
    [row] = await db.insert(assets).values(values).returning();
    const thumb = derivedUrl(resource.public_id, TRANSFORMS.thumbnail);
    await db.insert(provenance).values({
      assetId: row.id,
      purpose: "thumbnail",
      derivedUrl: thumb.url,
      transformation: thumb.transformation,
    });
  }

  return {
    publicId: resource.public_id,
    status: existing ? "updated" : "created",
    assetId: row.id,
    siteId: row.siteId,
    phase: row.phase,
    flags: row.flags,
  };
}

export function buildSearchText(p: {
  caption: string | null;
  tags: string[];
  siteName?: string;
  phase: Phase;
  capturedAt: Date | null;
}): string {
  const parts = [
    p.caption,
    p.tags.length ? `Tags: ${p.tags.join(", ")}` : null,
    p.siteName ? `Site: ${p.siteName}` : null,
    p.phase !== "unknown" ? `Phase: ${p.phase}` : null,
    p.capturedAt ? `Captured: ${p.capturedAt.toISOString().slice(0, 10)}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

/** Embeds any assets in the list that have search text but no embedding yet. */
export async function embedPending(db: Database, assetIds: string[]): Promise<number> {
  if (!assetIds.length) return 0;
  const rows: Array<{ id: string; searchText: string | null; embedding: number[] | null }> = [];
  for (const id of assetIds) {
    const r = await db.query.assets.findFirst({
      where: eq(assets.id, id),
      columns: { id: true, searchText: true, embedding: true },
    });
    if (r && r.searchText && !r.embedding) rows.push(r);
  }
  if (!rows.length) return 0;

  const vectors = await embedTexts(
    rows.map((r) => r.searchText!),
    "document",
  );
  if (!vectors) return 0;

  for (let i = 0; i < rows.length; i++) {
    await db
      .update(assets)
      .set({ embedding: vectors[i], embeddingModel: embeddingModelName() })
      .where(eq(assets.id, rows[i].id));
  }
  return rows.length;
}

/** Drops bulky fields that add nothing to auditability before storing the raw payload. */
function stripHeavy(res: CloudinaryResource): Record<string, unknown> {
  const { image_metadata, colors, ...rest } = res;
  void image_metadata;
  void colors;
  return rest;
}
