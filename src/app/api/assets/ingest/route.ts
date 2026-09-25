import { getDb } from "@/server/db";
import { ok, parseBody, route } from "@/server/http";
import { IngestSchema, ingestAssets } from "@/server/services/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Ingests uploaded Cloudinary assets into a project.
 * Runs analysis add-ons, EXIF parsing, site + phase assignment, verification and embeddings.
 */
export const POST = route(async (req) => {
  const body = await parseBody(req, IngestSchema);
  const db = await getDb();
  const results = await ingestAssets(db, body);
  const summary = {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    failed: results.filter((r) => r.status === "failed").length,
    flagged: results.filter((r) => (r.flags?.length ?? 0) > 0).length,
  };
  return ok({ summary, results });
});
