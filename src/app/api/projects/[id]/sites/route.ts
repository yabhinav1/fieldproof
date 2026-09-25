import { getDb } from "@/server/db";
import { created, ok, param, parseBody, route } from "@/server/http";
import { CreateSiteSchema, createSite, listSites } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const id = await param(ctx, "id");
  const db = await getDb();
  return ok(await listSites(db, id));
});

export const POST = route(async (req, ctx) => {
  const id = await param(ctx, "id");
  const body = await parseBody(req, CreateSiteSchema);
  const db = await getDb();
  return created(await createSite(db, id, body));
});
