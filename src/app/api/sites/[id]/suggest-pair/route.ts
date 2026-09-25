import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { suggestPair } from "@/server/services/comparisons";
import { getSite } from "@/server/services/projects";

export const dynamic = "force-dynamic";

/** Suggests the default before/after pair for a site. Returns null when there is not enough data. */
export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  await getSite(db, id);
  return ok(await suggestPair(db, id));
});
