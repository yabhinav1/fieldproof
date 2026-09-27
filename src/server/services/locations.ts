import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { locations } from "@/server/db/schema";

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

export async function listLocations(
  db: any,
  query: z.infer<typeof ListLocationsQuery>,
) {
  const conditions = [
    eq(locations.projectId, query.projectId),
  ];

  if (query.siteId) {
    conditions.push(eq(locations.siteId, query.siteId));
  }

  if (query.q) {
    conditions.push(ilike(locations.name, `%${query.q}%`));
  }

  return db
    .select()
    .from(locations)
    .where(and(...conditions))
    .orderBy(asc(locations.name));
}

export async function createLocation(
  db: any,
  input: z.infer<typeof CreateLocationSchema>,
) {
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