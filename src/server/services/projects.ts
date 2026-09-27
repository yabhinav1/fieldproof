import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, projects, sites } from "../db/schema";
import { notFound, badRequest } from "../http";

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers and dashes")
    .optional(),
  description: z.string().max(2000).optional(),
  orgName: z.string().max(120).optional(),
  duringStart: z.coerce.date().optional(),
  afterStart: z.coerce.date().optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export const CreateSiteSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(50_000).optional(),
});

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createProject(db: Database, input: z.infer<typeof CreateProjectSchema>) {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw badRequest("Could not derive a slug from the project name.");
  if (input.duringStart && input.afterStart && input.duringStart > input.afterStart) {
    throw badRequest("duringStart must be before afterStart.");
  }
  const [row] = await db
    .insert(projects)
    .values({
      name: input.name,
      slug,
      description: input.description,
      orgName: input.orgName,
      duringStart: input.duringStart,
      afterStart: input.afterStart,
    })
    .returning();
  return row;
}

export async function updateProject(db: Database, id: string, input: z.infer<typeof UpdateProjectSchema>) {
  await getProject(db, id);
  const [row] = await db
    .update(projects)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.orgName !== undefined && { orgName: input.orgName }),
      ...(input.duringStart !== undefined && { duringStart: input.duringStart }),
      ...(input.afterStart !== undefined && { afterStart: input.afterStart }),
    })
    .where(eq(projects.id, id))
    .returning();
  return row;
}

export async function listProjects(db: Database) {
  const [rows, siteCounts, assetCounts] = await Promise.all([
    db.select().from(projects).orderBy(projects.createdAt),
    db.select({ projectId: sites.projectId, n: count() }).from(sites).groupBy(sites.projectId),
    db.select({ projectId: assets.projectId, n: count() }).from(assets).groupBy(assets.projectId),
  ]);
  const siteMap = new Map(siteCounts.map((r) => [r.projectId, Number(r.n)]));
  const assetMap = new Map(assetCounts.map((r) => [r.projectId, Number(r.n)]));
  return rows.map((p) => ({ ...p, siteCount: siteMap.get(p.id) ?? 0, assetCount: assetMap.get(p.id) ?? 0 }));
}

export async function getProject(db: Database, id: string) {
  const row = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!row) throw notFound("Project");
  return row;
}

export async function getProjectBySlugOrId(db: Database, key: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const row = await db.query.projects.findFirst({ where: isUuid ? eq(projects.id, key) : eq(projects.slug, key) });
  if (!row) throw notFound("Project");
  return row;
}

/** Project with sites and per-site / per-phase asset counts, for the dashboard header. */
export async function getProjectOverview(db: Database, id: string) {
  const project = await getProject(db, id);
  const siteRows = await db.select().from(sites).where(eq(sites.projectId, id)).orderBy(sites.createdAt);

  const counts = await db
    .select({ siteId: assets.siteId, phase: assets.phase, n: count() })
    .from(assets)
    .where(eq(assets.projectId, id))
    .groupBy(assets.siteId, assets.phase);

  const flagged = await db
    .select({ n: count() })
    .from(assets)
    .where(and(eq(assets.projectId, id), eq(assets.verified, false)));

  const emptyPhases = () => ({ before: 0, during: 0, after: 0, unknown: 0, total: 0 });
  const bySite = new Map<string | null, ReturnType<typeof emptyPhases>>();
  for (const c of counts) {
    const bucket = bySite.get(c.siteId) ?? emptyPhases();
    bucket[c.phase] += Number(c.n);
    bucket.total += Number(c.n);
    bySite.set(c.siteId, bucket);
  }

  const totals = emptyPhases();
  for (const b of bySite.values()) {
    totals.before += b.before;
    totals.during += b.during;
    totals.after += b.after;
    totals.unknown += b.unknown;
    totals.total += b.total;
  }

  const flaggedCount = Number(flagged[0]?.n ?? 0);
  return {
    ...project,
    sites: siteRows.map((s) => ({ ...s, assetCounts: bySite.get(s.id) ?? emptyPhases() })),
    unassignedAssets: bySite.get(null) ?? emptyPhases(),
    // `assets` and `verified` duplicate `total` / `total - flagged` under the names the dashboard uses.
    totals: { ...totals, flagged: flaggedCount, assets: totals.total, verified: totals.total - flaggedCount },
  };
}

export async function createSite(db: Database, projectId: string, input: z.infer<typeof CreateSiteSchema>) {
  await getProject(db, projectId);
  const [row] = await db
    .insert(sites)
    .values({ projectId, name: input.name, description: input.description, lat: input.lat, lng: input.lng, radiusM: input.radiusM })
    .returning();
  return row;
}

export async function listSites(db: Database, projectId: string) {
  return db.select().from(sites).where(eq(sites.projectId, projectId)).orderBy(sites.createdAt);
}

export async function getSite(db: Database, id: string) {
  const row = await db.query.sites.findFirst({ where: eq(sites.id, id) });
  if (!row) throw notFound("Site");
  return row;
}

export async function deleteProject(db: Database, id: string) {
  await getProject(db, id);
  await db.delete(projects).where(eq(projects.id, id));
}
