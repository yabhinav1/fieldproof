import { getDb } from "@/server/db";
import { created, ok, parseBody, parseQuery, route } from "@/server/http";
import {
  CreateLocationSchema,
  ListLocationsQuery,
  createLocation,
  listLocations,
} from "@/server/services/locations";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const q = parseQuery(req, ListLocationsQuery);
  const db = await getDb();

  return ok(await listLocations(db, q));
});

export const POST = route(async (req) => {
  const body = await parseBody(req, CreateLocationSchema);
  const db = await getDb();

  return created(await createLocation(db, body));
});
