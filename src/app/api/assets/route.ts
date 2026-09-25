import { getDb } from "@/server/db";
import { ok, parseQuery, route } from "@/server/http";
import { ListAssetsQuery, listAssets } from "@/server/services/assets";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const q = parseQuery(req, ListAssetsQuery);
  const db = await getDb();
  return ok(await listAssets(db, q));
});
