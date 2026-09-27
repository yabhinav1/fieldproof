import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { locations, sites } from "../db/schema";
import { badRequest } from "../http";

/**
 * Named field locations: a reusable label (with optional coordinates) inside a site, chosen at
 * upload time so repeat photography of the same spot can be grouped and compared.
 */

export const ListLocationsQuery = z.object({
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  q: z.string().trim().optional(),
});

export const CreateLocationSchema = z.object({
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
});

export async function listLocations(db: Database, query: z.infer<typeof ListLocationsQuery>) {
  const conditions = [eq(locations.projectId, query.projectId)];
  if (query.siteId) conditions.push(eq(locations.siteId, query.siteId));
  if (query.q) conditions.push(ilike(locations.name, `%${query.q.replace(/[%_]/g, "")}%`));

  return db
    .select()
    .from(locations)
    .where(and(...conditions))
    .orderBy(asc(locations.name));
}

export async function createLocation(db: Database, input: z.infer<typeof CreateLocationSchema>) {
  if (input.siteId) {
    const site = await db.query.sites.findFirst({ where: eq(sites.id, input.siteId) });
    if (!site || site.projectId !== input.projectId) throw badRequest("siteId does not belong to this project.");
  }
  const [location] = await db
    .insert(locations)
    .values({
      projectId: input.projectId,
      siteId: input.siteId ?? null,
      name: input.name,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .returning();
  return location;
}

/** The default location for a site (the earliest created), used when an upload names none. */
export async function defaultLocationForSite(db: Database, siteId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.siteId, siteId))
    .orderBy(asc(locations.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Ensures every site in a project has at least one location (named after the site, at its
 * coordinates). Returns a map siteId -> locationId. Idempotent.
 */
export async function ensureSiteLocations(db: Database, projectId: string): Promise<Map<string, string>> {
  const siteRows = await db.select().from(sites).where(eq(sites.projectId, projectId));
  const map = new Map<string, string>();
  for (const site of siteRows) {
    let id = await defaultLocationForSite(db, site.id);
    if (!id) {
      const [created] = await db
        .insert(locations)
        .values({ projectId, siteId: site.id, name: site.name, lat: site.lat, lng: site.lng })
        .returning();
      id = created.id;
    }
    map.set(site.id, id);
  }
  return map;
}
