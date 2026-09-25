import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { assetTimeline } from "@/server/services/assets";

export const dynamic = "force-dynamic";

/** Assets grouped by site and phase, oldest first. Drives the gallery + timeline strip. */
export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await assetTimeline(db, id));
});
