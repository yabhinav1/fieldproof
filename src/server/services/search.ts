import { and, cosineDistance, desc, eq, gte, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, locations } from "../db/schema";
import { embedText, embeddingsAvailable } from "../ai/embeddings";
import { badRequest } from "../http";
import { InclusiveEndDate } from "../lib/dates";
import { publicAsset } from "./assets";

export const SearchQuery = z.object({
  q: z.string().trim().min(1).max(500),
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  phase: z.enum(["before", "during", "after", "unknown"]).optional(),
  from: z.coerce.date().optional(),
  to: InclusiveEndDate.optional(),
  verifiedOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type SearchMode = "hybrid" | "semantic" | "keyword";

export interface SearchHit {
  asset: ReturnType<typeof publicAsset>;
  score: number;
  matchedBy: Array<"semantic" | "keyword">;
}

/**
 * Hybrid search: vector similarity (when embeddings are configured) fused with Postgres
 * full-text search via reciprocal rank fusion. Falls back to keyword-only with zero config.
 */
export async function searchAssets(db: Database, q: z.infer<typeof SearchQuery>): Promise<{ mode: SearchMode; hits: SearchHit[] }> {
  const filters: SQL[] = [eq(assets.projectId, q.projectId)];
  if (q.siteId) filters.push(eq(assets.siteId, q.siteId));
  if (q.phase) filters.push(eq(assets.phase, q.phase));
  if (q.from) filters.push(gte(assets.capturedAt, q.from));
  if (q.to) filters.push(lte(assets.capturedAt, q.to));
  if (q.verifiedOnly === "true") filters.push(eq(assets.verified, true));

  if (q.locationId) {
    // Filtering here rather than in the browser: applied after `limit`, a location's photos that
    // rank below the cut would be dropped and the search would wrongly come back empty.
    const location = await db.query.locations.findFirst({ where: eq(locations.id, q.locationId) });
    if (!location || location.projectId !== q.projectId) throw badRequest("locationId does not belong to this project.");
    // Assets ingested before locations existed have none; those fall back to the location's site.
    const legacy = location.siteId ? and(isNull(assets.locationId), eq(assets.siteId, location.siteId)) : undefined;
    filters.push(legacy ? or(eq(assets.locationId, location.id), legacy)! : eq(assets.locationId, location.id));
  }

  const candidateLimit = Math.max(q.limit * 3, 50);

  // --- keyword leg (always available) ---
  const tsQuery = sql`websearch_to_tsquery('english', ${q.q})`;
  const tsVector = sql`to_tsvector('english', coalesce(${assets.searchText}, ''))`;
  const keywordRows = await db
    .select({ row: assets, rank: sql<number>`ts_rank_cd(${tsVector}, ${tsQuery})`.mapWith(Number) })
    .from(assets)
    .where(and(...filters, sql`${tsVector} @@ ${tsQuery}`))
    .orderBy(desc(sql`ts_rank_cd(${tsVector}, ${tsQuery})`))
    .limit(candidateLimit);

  // Also catch partial words the stemmer misses (e.g. "volunt" for volunteers).
  const likeRows =
    keywordRows.length < 5
      ? await db
          .select({ row: assets })
          .from(assets)
          .where(and(...filters, sql`${assets.searchText} ILIKE ${"%" + q.q.replace(/[%_]/g, "") + "%"}`))
          .limit(candidateLimit)
      : [];

  // --- semantic leg (optional) ---
  let semanticRows: Array<{ row: typeof assets.$inferSelect; similarity: number }> = [];
  let mode: SearchMode = "keyword";
  if (embeddingsAvailable()) {
    // A throttled or unreachable embedding provider must not take keyword search down with it.
    const vector = await embedText(q.q, "query").catch((err) => {
      console.warn(`[search] query embedding failed; keyword results only: ${err instanceof Error ? err.message : err}`);
      return null;
    });
    if (vector) {
      const similarity = sql<number>`1 - (${cosineDistance(assets.embedding, vector)})`;
      semanticRows = await db
        .select({ row: assets, similarity: similarity.mapWith(Number) })
        .from(assets)
        .where(and(...filters, isNotNull(assets.embedding)))
        .orderBy(desc(similarity))
        .limit(candidateLimit);
      // Drop weak matches so a query about "flooding" doesn't return every photo.
      semanticRows = semanticRows.filter((r) => r.similarity >= 0.35);
      mode = "hybrid";
    }
  }

  // --- reciprocal rank fusion ---
  const K = 60;
  const fused = new Map<string, SearchHit>();
  const add = (row: typeof assets.$inferSelect, rank: number, leg: "semantic" | "keyword") => {
    const inc = 1 / (K + rank);
    const existing = fused.get(row.id);
    if (existing) {
      existing.score += inc;
      if (!existing.matchedBy.includes(leg)) existing.matchedBy.push(leg);
    } else {
      fused.set(row.id, { asset: publicAsset(row), score: inc, matchedBy: [leg] });
    }
  };
  semanticRows.forEach((r, i) => add(r.row, i + 1, "semantic"));
  keywordRows.forEach((r, i) => add(r.row, i + 1, "keyword"));
  likeRows.forEach((r, i) => add(r.row, keywordRows.length + i + 1, "keyword"));

  const hits = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, q.limit);
  if (mode === "hybrid" && semanticRows.length === 0 && hits.length) mode = "keyword";
  return { mode, hits };
}
