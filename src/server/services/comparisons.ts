import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, comparisons, provenance, sites } from "../db/schema";
import { TRANSFORMS, derivedUrl } from "../cloudinary";
import { compareImages, toStoredMetrics } from "../ai/compare";
import { badRequest, notFound } from "../http";
import { PHASE_ORDER } from "../lib/phase";
import { getAsset } from "./assets";
import { getProject } from "./projects";

export const CreateComparisonSchema = z.object({
  beforeAssetId: z.string().uuid(),
  afterAssetId: z.string().uuid(),
  /**
   * same_spot (default): strict repeat photography, metrics only when it is the same place.
   * representative: compare depicted conditions even from different vantage points; labelled as such.
   */
  mode: z.enum(["same_spot", "representative"]).default("same_spot"),
});

export const ListComparisonsQuery = z.object({
  projectId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});

/**
 * Creates a before/after comparison: derives matched-size images from Cloudinary,
 * asks the vision model for a structured change assessment, and records both derivations.
 */
export async function createComparison(db: Database, input: z.infer<typeof CreateComparisonSchema>) {
  if (input.beforeAssetId === input.afterAssetId) throw badRequest("Pick two different assets.");
  const before = await getAsset(db, input.beforeAssetId);
  const after = await getAsset(db, input.afterAssetId);
  if (before.projectId !== after.projectId) throw badRequest("Both assets must belong to the same project.");

  const project = await getProject(db, before.projectId);
  const siteId = before.siteId && before.siteId === after.siteId ? before.siteId : (after.siteId ?? before.siteId);
  const site = siteId ? await db.query.sites.findFirst({ where: eq(sites.id, siteId) }) : null;

  const beforeDerived = derivedUrl(before.cloudinaryPublicId, TRANSFORMS.comparison);
  const afterDerived = derivedUrl(after.cloudinaryPublicId, TRANSFORMS.comparison);

  const { result, model } = await compareImages({
    beforeUrl: beforeDerived.url,
    afterUrl: afterDerived.url,
    mode: input.mode,
    siteName: site?.name,
    projectName: project.name,
  });

  const [row] = await db
    .insert(comparisons)
    .values({
      projectId: project.id,
      siteId: siteId ?? null,
      beforeAssetId: before.id,
      afterAssetId: after.id,
      beforeUrl: beforeDerived.url,
      afterUrl: afterDerived.url,
      mode: input.mode,
      headline: result.headline,
      summary: result.summary,
      sameLocation: result.same_location,
      locationConfidence: result.location_confidence,
      metrics: toStoredMetrics(result),
      model,
    })
    .returning();

  await db.insert(provenance).values([
    {
      assetId: before.id,
      purpose: "comparison",
      derivedUrl: beforeDerived.url,
      transformation: beforeDerived.transformation,
      referenceType: "comparison",
      referenceId: row.id,
    },
    {
      assetId: after.id,
      purpose: "comparison",
      derivedUrl: afterDerived.url,
      transformation: afterDerived.transformation,
      referenceType: "comparison",
      referenceId: row.id,
    },
  ]);

  return row;
}

export async function getComparison(db: Database, id: string) {
  const row = await db.query.comparisons.findFirst({ where: eq(comparisons.id, id) });
  if (!row) throw notFound("Comparison");
  return row;
}

export async function listComparisons(db: Database, q: z.infer<typeof ListComparisonsQuery>) {
  if (!q.projectId && !q.siteId) throw badRequest("Provide projectId or siteId.");
  const where = [q.projectId ? eq(comparisons.projectId, q.projectId) : undefined, q.siteId ? eq(comparisons.siteId, q.siteId) : undefined].filter(
    Boolean,
  ) as ReturnType<typeof eq>[];
  return db
    .select()
    .from(comparisons)
    .where(and(...where))
    .orderBy(desc(comparisons.generatedAt));
}

export async function deleteComparison(db: Database, id: string) {
  await getComparison(db, id);
  await db.delete(comparisons).where(eq(comparisons.id, id));
}

/**
 * Suggests a before/after pair for a site: the earliest verified "before" photo and the
 * latest verified "after" photo. The frontend can offer this as a one-click default.
 */
export async function suggestPair(db: Database, siteId: string) {
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.siteId, siteId), eq(assets.verified, true)))
    .orderBy(assets.capturedAt);

  const befores = rows.filter((r) => r.phase === "before" && r.capturedAt);
  const afters = rows.filter((r) => r.phase === "after" && r.capturedAt);
  if (!befores.length || !afters.length) {
    // Fall back to earliest vs latest of anything with a date and a known phase order.
    const dated = rows.filter((r) => r.capturedAt && PHASE_ORDER[r.phase] >= 0);
    if (dated.length < 2) return null;
    return { beforeAssetId: dated[0].id, afterAssetId: dated[dated.length - 1].id, strategy: "earliest_latest" as const };
  }
  return { beforeAssetId: befores[0].id, afterAssetId: afters[afters.length - 1].id, strategy: "phase" as const };
}
