import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, provenance, sites, type Asset } from "../db/schema";
import { notFound, badRequest } from "../http";
import { assignPhase } from "../lib/phase";
import { getProject } from "./projects";

export const ListAssetsQuery = z.object({
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  phase: z.enum(["before", "during", "after", "unknown"]).optional(),
  verified: z.enum(["true", "false"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UpdateAssetSchema = z.object({
  siteId: z.string().uuid().nullable().optional(),
  phase: z.enum(["before", "during", "after", "unknown"]).optional(),
  /** Set to true to clear any manual phase and recompute it from EXIF. */
  resetPhase: z.boolean().optional(),
  verified: z.boolean().optional(),
});

/** Public shape: everything except the raw Cloudinary dump and the vector. */
export type PublicAsset = Omit<Asset, "cloudinaryRaw" | "embedding"> & { hasEmbedding: boolean };

export function publicAsset(a: Asset): PublicAsset {
  const { cloudinaryRaw, embedding, ...rest } = a;
  void cloudinaryRaw;
  return { ...rest, hasEmbedding: Boolean(embedding) };
}

export async function listAssets(db: Database, q: z.infer<typeof ListAssetsQuery>) {
  const where: SQL[] = [eq(assets.projectId, q.projectId)];
  if (q.siteId) where.push(eq(assets.siteId, q.siteId));
  if (q.phase) where.push(eq(assets.phase, q.phase));
  if (q.verified) where.push(eq(assets.verified, q.verified === "true"));
  if (q.from) where.push(gte(assets.capturedAt, q.from));
  if (q.to) where.push(lte(assets.capturedAt, q.to));

  const rows = await db
    .select()
    .from(assets)
    .where(and(...where))
    .orderBy(desc(assets.capturedAt), desc(assets.createdAt))
    .limit(q.limit)
    .offset(q.offset);
  return rows.map((r) => publicAsset(r));
}

/** Timeline: assets grouped by site and phase, oldest first, for the gallery strip. */
export async function assetTimeline(db: Database, projectId: string) {
  await getProject(db, projectId);
  const rows = await db
    .select()
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(assets.capturedAt, assets.createdAt);

  const bySite = new Map<string | null, { before: unknown[]; during: unknown[]; after: unknown[]; unknown: unknown[] }>();
  for (const r of rows) {
    const bucket = bySite.get(r.siteId) ?? { before: [], during: [], after: [], unknown: [] };
    bucket[r.phase].push(publicAsset(r));
    bySite.set(r.siteId, bucket);
  }
  return [...bySite.entries()].map(([siteId, phases]) => ({ siteId, ...phases }));
}

export async function getAsset(db: Database, id: string) {
  const row = await db.query.assets.findFirst({ where: eq(assets.id, id) });
  if (!row) throw notFound("Asset");
  return row;
}

/** Asset plus everything needed for the provenance panel. */
export async function getAssetDetail(db: Database, id: string) {
  const row = await getAsset(db, id);
  const derivations = await db.select().from(provenance).where(eq(provenance.assetId, id)).orderBy(provenance.createdAt);
  const site = row.siteId ? await db.query.sites.findFirst({ where: eq(sites.id, row.siteId) }) : null;
  return {
    ...publicAsset(row),
    site,
    provenance: {
      source: {
        cloudinaryPublicId: row.cloudinaryPublicId,
        version: row.cloudinaryVersion,
        originalUrl: row.secureUrl,
        uploadedAt: row.uploadedAt,
        format: row.format,
        width: row.width,
        height: row.height,
        bytes: row.bytes,
        phash: row.phash,
      },
      exif: row.exif,
      ai: { tags: row.aiTags, caption: row.aiCaption, embeddingModel: row.embeddingModel },
      derivations,
    },
  };
}

export async function updateAsset(db: Database, id: string, input: z.infer<typeof UpdateAssetSchema>) {
  const row = await getAsset(db, id);
  const patch: Partial<typeof assets.$inferInsert> = { updatedAt: new Date() };

  if (input.siteId !== undefined) {
    if (input.siteId) {
      const site = await db.query.sites.findFirst({ where: eq(sites.id, input.siteId) });
      if (!site || site.projectId !== row.projectId) throw badRequest("siteId does not belong to this project.");
    }
    patch.siteId = input.siteId;
    patch.siteOverridden = input.siteId !== null;
  }

  if (input.resetPhase) {
    const project = await getProject(db, row.projectId);
    const exifDate = row.exif ? extractExifDate(row.exif) : null;
    patch.phase = assignPhase(exifDate, project);
    patch.phaseOverridden = false;
  } else if (input.phase !== undefined) {
    patch.phase = input.phase;
    patch.phaseOverridden = true;
  }

  if (input.verified !== undefined) patch.verified = input.verified;

  const [updated] = await db.update(assets).set(patch).where(eq(assets.id, id)).returning();
  return publicAsset(updated);
}

export async function deleteAsset(db: Database, id: string) {
  await getAsset(db, id);
  await db.delete(assets).where(eq(assets.id, id));
}

// Local import to avoid a cycle with ingest.ts
import { extractCapturedAt as extractExifDate } from "../lib/exif";
