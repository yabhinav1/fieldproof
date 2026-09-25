import { getDb } from "@/server/db";
import { ok, param, route } from "@/server/http";
import { reportSources } from "@/server/services/reports";

export const dynamic = "force-dynamic";

/** Original source assets behind a report, for the traceability appendix. */
export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await reportSources(db, id));
});
