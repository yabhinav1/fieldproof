import { getDb } from "@/server/db";
import { ok, parseQuery, route } from "@/server/http";
import { SearchQuery, searchAssets } from "@/server/services/search";

export const dynamic = "force-dynamic";

/** Natural-language search over captions, tags and embeddings, with site / phase / date filters. */
export const GET = route(async (req) => {
  const q = parseQuery(req, SearchQuery);
  const db = await getDb();
  return ok(await searchAssets(db, q));
});
